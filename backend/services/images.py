from io import BytesIO
import warnings
from PIL import Image, ImageOps, UnidentifiedImageError
from backend.core.errors import AppError


def prepare_image(file, settings):
    content = file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise AppError(413, "Файл больше 10 МБ. Уменьши изображение и попробуй ещё раз.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise AppError(415, "Поддерживаются JPG, PNG и WebP.")
                if image.width * image.height > settings.max_image_pixels:
                    raise AppError(413, "Изображение слишком большое. Максимум — 20 мегапикселей.")
                image = ImageOps.exif_transpose(image)
                if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
                    rgba = image.convert("RGBA")
                    clean = Image.new("RGB", rgba.size, "white")
                    clean.paste(rgba, mask=rgba.getchannel("A"))
                else:
                    clean = image.convert("RGB")
                clean.thumbnail((2400, 2400))
                encoded = BytesIO()
                clean.save(encoded, "JPEG", quality=90)
                return encoded.getvalue()
    except (UnidentifiedImageError, OSError, ValueError):
        raise AppError(415, "Не удалось прочитать изображение. Выбери JPG, PNG или WebP.")
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise AppError(413, "Изображение слишком большое. Максимум — 20 мегапикселей.")
