import base64
import gzip
import json
import cv2
import numpy as np



PREFIX = "SHAPEZ2-4-"
VERSION = 1134



def parse_blueprint(blueprint: str) -> dict:
	blueprint_base64 = blueprint[len(PREFIX):]
	blueprint_compressed = base64.b64decode(blueprint_base64)
	blueprint_json = json.loads(gzip.decompress(blueprint_compressed).decode("UTF-8"))
	return blueprint_json

def build_blueprint(blueprint_json: dict) -> str:
	blueprint_json: str = json.dumps(blueprint_json)
	blueprint_compressed = gzip.compress(blueprint_json.encode("UTF-8"))
	blueprint_base64 = base64.b64encode(blueprint_compressed).decode("ASCII")
	return PREFIX + blueprint_base64 + "$"

def make_foundation_blueprint_template(type: str = "Foundation_3x3") -> dict:
	return {
		"V": VERSION,
		"BP": {
			"$type": "Island",
			"Icon": {"Data": ["icon:Platforms", None, None, "shape:RuRuRuRu"]},
			"Entries": [
				{
					"T": type,
					"B": {
						"$type": "Building",
						"Icon": {"Data": ["icon:Buildings", None, None, "shape:CuCuCuCu"]},
						"Entries": [],
						"BinaryVersion": VERSION
					}
				}
			],
			"BinaryVersion": VERSION
		}
	}



def empty_background_provider(x: int, y: int) -> list[dict]:
	return []

def trash_background_provider(x: int, y: int) -> list[dict]:
	return [{"X": x, "Y": y, "T": "TrashDefaultInternalVariant"}]

def display_background_provider(x: int, y: int) -> list[dict]:
	if (x + 15) % 6 != 0 or (y + 15) % 6 != 0:
		return []
	return [
		{"X": x, "Y": y, "R": 3, "T": "Display3x3InternalVariant"},
		{"X": x, "Y": y + 1, "R": 1, "T": "Display3x3InternalVariantMirrored"},
		{"X": x + 1, "Y": y, "R": 3, "T": "Display3x3InternalVariantMirrored"},
		{"X": x + 1, "Y": y + 1, "R": 1, "T": "Display3x3InternalVariant"}
	]

background_providers = {
	"empty": empty_background_provider,
	"trash": trash_background_provider,
	"display": display_background_provider
}

def make_canvas_blueprint_template(background_type: str) -> dict:
	background = []
	background_provider = background_providers[background_type]
	for x in range(-17, 37):
		for y in range(-17, 37):
			background += background_provider(x, y)
	blueprint_json = make_foundation_blueprint_template()
	blueprint_json["BP"]["Entries"][0]["B"]["Entries"] = background
	return blueprint_json

def parse_label_content(content: str) -> str:
	return base64.b64decode(content.encode())[2:].decode()

def build_label_content(content: str) -> str:
	return base64.b64encode(b" \x01" + content.encode()).decode()



def load_grayscale_image(image_path: str) -> np.ndarray:
	image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
	return image.astype(np.float32) / 255.0

def normalize_grayscale(
	image: np.ndarray,
	min_grayscale: float | None = None,
	max_grayscale: float | None = None
) -> np.ndarray:
	original_min = np.min(image)
	original_max = np.max(image)
	if min_grayscale is None:
		min_grayscale = original_min
	if max_grayscale is None:
		max_grayscale = original_max
	normalized_image = (image - original_min) / max(original_max - original_min, 1e-8)
	return normalized_image * (max_grayscale - min_grayscale) + min_grayscale

def resize_image(image: np.ndarray, width: int, height: int) -> np.ndarray:
	return cv2.resize(image, (width, height), interpolation = cv2.INTER_AREA)

def posterize(image: np.ndarray, grayscale_ramp: str) -> np.ndarray:
	palette = np.linspace(0, 1, len(grayscale_ramp))
	indices = np.argmin(np.abs(image[..., None] - palette), axis = -1)
	return palette[indices]

def dither(image: np.ndarray, grayscale_ramp: str) -> np.ndarray:
	palette = np.linspace(0, 1, len(grayscale_ramp))
	dithered = image.copy()
	height, width = dithered.shape
	for y in range(height):
		for x in range(width):
			real_grayscale = dithered[y, x]
			posterized_grayscale = palette[np.argmin(np.abs(palette - real_grayscale))]
			dithered[y, x] = posterized_grayscale
			if y == height - 1 or x == 0 or x == width - 1:
				continue
			error = real_grayscale - posterized_grayscale
			dithered[y,     x + 1] += error * 7 / 16
			dithered[y + 1, x - 1] += error * 3 / 16
			dithered[y + 1, x    ] += error * 5 / 16
			dithered[y + 1, x + 1] += error * 1 / 16
	return dithered



def image_to_ascii(
	posterized_image: np.ndarray,
	grayscale_ramp: str
) -> np.ndarray:
	indices = (posterized_image * (len(grayscale_ramp) - 1)).astype(np.uint16)
	ascii = np.array(list(grayscale_ramp))[indices]
	return ascii

def ascii_to_blueprint_json(
	ascii: np.ndarray,
	size = 1050,
	parallax: float = 0,
	background_type: str = "display"
) -> dict:
	blueprint_json = make_canvas_blueprint_template(background_type)
	
	def make_label_content_template(side, column):
		template_index = side * 6 + column % 6
		padding = "ㅤ" * (31 + (template_index // 2 if side == 0 else 5 - template_index // 2))
		offset = (-800 if side == 1 else 300) + (column % 6) // 2 * 400
		indent = (column % 6 - 2.5) * 10000 / 6
		if column % 2 == 0:
			indent = indent + (column - ascii.shape[1] / 2) * parallax
		return f"<voffset={offset}><indent={round(indent)}><size={size}><line-height=1600>{'{}' + padding if side == 0 else padding + '{}'}"
	
	for side in range(2):
		for column in range(ascii.shape[1]):
			label_x = -13 + 5 * (column // 6)
			label_y = (34 if side == 0 else -17) + (column % 6) // 2
			label_layer = column % 2 + 1
			label_ascii = ""
			for row in range(side, ascii.shape[0], 2):
				label_ascii += ascii[row][column]
			label_content_template = make_label_content_template(side, column)
			label_content = label_content_template.format(label_ascii)
			blueprint_json["BP"]["Entries"][0]["B"]["Entries"].append({
				"X": label_x,
				"Y": label_y,
				"L": label_layer,
				"T": "LabelDefaultInternalVariant",
				"C": build_label_content(label_content)
			})
	return blueprint_json



def build_3x3_ascii_blueprint(
	image_path: str,
	min_grayscale: float | None = None,
	max_grayscale: float | None = None,
	font_size: int = 1050,
	# grayscale_ramp: str = "M@%&B8OXUZ0bhyaouxzvc{1?fI[t*<=r^/+\"~;:_-,'`.ㅤ"[::-1],
	grayscale_ramp: str = "ѬM@%&B8G60bhXZyaoxuzvct*r⁰<=⁙•°″\";~:_-'.ㅤ"[::-1],
	dithering: bool = False,
	parallax: float = 15,
	background_type: str = "display"
) -> str:
	image = load_grayscale_image(image_path)
	image = normalize_grayscale(image, min_grayscale, max_grayscale)
	image = resize_image(image, 60, 60)
	image = (dither if dithering else posterize)(image, grayscale_ramp)
	ascii = image_to_ascii(image, grayscale_ramp)
	blueprint_json = ascii_to_blueprint_json(ascii, font_size, parallax, background_type)
	return build_blueprint(blueprint_json)



if __name__ == "__main__":
	# NOTE: Input your image path here!
	image_path = ...
	print(build_3x3_ascii_blueprint(image_path))
