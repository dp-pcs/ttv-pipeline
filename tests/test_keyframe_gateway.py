import base64
from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image

import keyframe_generator
from video_generator_interface import recorded_keyframe


def _png(width, height):
    buffer = BytesIO()
    Image.new("RGB", (width, height), color="navy").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


class _FakeOpenAI:
    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.calls = []
        _FakeOpenAI.instances.append(self)
        outer = self

        class Images:
            def generate(self, **request):
                outer.calls.append(("generate", request))
                return SimpleNamespace(data=[SimpleNamespace(b64_json=_png(1536, 1024), url=None)], usage=None)

            def edit(self, **request):
                outer.calls.append(("edit", request))
                return SimpleNamespace(data=[SimpleNamespace(b64_json=_png(1536, 1024), url=None)], usage=None)

        self.images = Images()


GATEWAY = {
    "base_url": "https://gateway.example.com",
    "api_key_env": "TEST_IMAGE_GATEWAY_KEY",
    "default_headers": {"X-TFY-METADATA": "{}", "X-TFY-LOGGING-CONFIG": '{"enabled": true}'},
    "size": "1536x1024",
}


@pytest.fixture(autouse=True)
def fake_openai(monkeypatch):
    import openai

    _FakeOpenAI.instances.clear()
    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAI)
    monkeypatch.setenv("TEST_IMAGE_GATEWAY_KEY", "fixture-key")


def test_gateway_keyframe_uses_configured_endpoint_key_and_delivery_aspect(tmp_path):
    output = tmp_path / "frame.png"
    result = keyframe_generator._generate_keyframe(
        "A dark observatory dome", str(output), "team/gpt-image-model", gateway=GATEWAY, aspect_ratio="16:9", max_retries=0
    )
    client = _FakeOpenAI.instances[0]
    assert client.kwargs["api_key"] == "fixture-key"
    assert client.kwargs["base_url"] == "https://gateway.example.com"
    assert client.kwargs["default_headers"]["X-TFY-LOGGING-CONFIG"] == '{"enabled": true}'
    kind, request = client.calls[0]
    assert kind == "generate" and request["model"] == "team/gpt-image-model" and request["size"] == "1536x1024"
    with Image.open(result) as image:
        assert image.format == "PNG"
        assert image.size == (1536, 864)


def test_gateway_keyframe_records_provenance_without_the_key(tmp_path):
    recorded = recorded_keyframe(keyframe_generator._generate_keyframe)
    output = recorded("A dark observatory dome", str(tmp_path / "frame.png"), "team/gpt-image-model",
                      gateway=GATEWAY, aspect_ratio="16:9", max_retries=0)
    assert output.provider == "openai-compatible"
    assert output.model == "team/gpt-image-model"
    assert output.parameters["gateway"] == "gateway.example.com"
    assert output.parameters["center_crop"] == [0, 80, 1536, 944]
    assert "fixture-key" not in repr(output)


def test_gateway_keyframe_edits_when_a_reference_is_supplied(tmp_path):
    reference = tmp_path / "reference.png"
    Image.new("RGB", (64, 36), color="gray").save(reference)
    keyframe_generator._generate_keyframe(
        "Same room at dawn", str(tmp_path / "frame.png"), "team/gpt-image-model",
        input_image_path=str(reference), gateway=GATEWAY, aspect_ratio="16:9", max_retries=0
    )
    assert _FakeOpenAI.instances[0].calls[0][0] == "edit"


def test_gateway_keyframe_requires_the_named_key_variable(tmp_path, monkeypatch):
    monkeypatch.delenv("TEST_IMAGE_GATEWAY_KEY")
    with pytest.raises(ValueError, match="TEST_IMAGE_GATEWAY_KEY"):
        keyframe_generator._generate_keyframe(
            "prompt", str(tmp_path / "frame.png"), "team/gpt-image-model", gateway=GATEWAY, max_retries=0
        )
