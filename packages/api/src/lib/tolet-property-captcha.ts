import { randomInt } from "node:crypto";

/**
 * Hand-drawn digit strokes on a 10 x 16 grid. Digits are drawn as paths, never
 * <text>, so the answer is not readable from the SVG source.
 */
const DIGIT_STROKES: Record<string, number[][][]> = {
	"0": [[[5, 0], [9, 3], [9, 13], [5, 16], [1, 13], [1, 3], [5, 0]]],
	"1": [[[3, 3], [6, 0], [6, 16]], [[3, 16], [9, 16]]],
	"2": [[[1, 3], [4, 0], [7, 0], [9, 3], [9, 6], [1, 16], [9, 16]]],
	"3": [[[1, 1], [8, 0], [9, 4], [5, 7], [9, 10], [9, 14], [6, 16], [1, 15]]],
	"4": [[[7, 16], [7, 0], [1, 11], [10, 11]]],
	"5": [[[9, 0], [2, 0], [1, 7], [6, 6], [9, 9], [9, 13], [6, 16], [1, 15]]],
	"6": [[[8, 0], [3, 3], [1, 9], [1, 13], [4, 16], [8, 15], [9, 11], [7, 8], [3, 8], [1, 10]]],
	"7": [[[1, 0], [9, 0], [4, 16]]],
	"8": [
		[[5, 0], [8, 2], [8, 5], [5, 7.5], [2, 5], [2, 2], [5, 0]],
		[[5, 7.5], [9, 10], [9, 14], [5, 16], [1, 14], [1, 10], [5, 7.5]],
	],
	"9": [[[9, 6], [7, 8], [3, 8], [1, 5], [2, 1], [5, 0], [8, 1], [9, 6], [8, 12], [5, 16], [2, 15]]],
};

const WIDTH = 220;
const HEIGHT = 70;
const INK = ["#1e293b", "#1e3a8a", "#7c2d12", "#14532d", "#581c87"];

/** Uniform random number in [min, max), from the CSPRNG. */
function between(min: number, max: number) {
	return min + (randomInt(0, 10_000) / 10_000) * (max - min);
}

function round(value: number) {
	return Math.round(value * 10) / 10;
}

/** Distorted picture of a numeric code, for the property-contact captcha. */
export function renderPropertyCaptchaSvg(code: string) {
	const parts: string[] = [];
	const noise = () =>
		`<path d="M${round(between(0, WIDTH / 3))} ${round(between(0, HEIGHT))} Q${round(between(0, WIDTH))} ${round(between(0, HEIGHT))} ${round(between((WIDTH * 2) / 3, WIDTH))} ${round(between(0, HEIGHT))}" stroke="${INK[randomInt(0, INK.length)]}" stroke-width="${round(between(1, 2.2))}" fill="none" opacity="0.55"/>`;

	for (let i = 0; i < 4; i++) parts.push(noise());

	const cell = (WIDTH - 24) / code.length;
	[...code].forEach((digit, index) => {
		const scale = between(2.4, 2.9);
		const angle = between(-20, 20);
		const x = 12 + cell * index + (cell - 10 * scale) / 2 + between(-3, 3);
		const y = (HEIGHT - 16 * scale) / 2 + between(-5, 5);
		const d = (DIGIT_STROKES[digit] ?? [])
			.map((stroke) =>
				stroke
					.map(
						([px = 0, py = 0], pointIndex) =>
							`${pointIndex === 0 ? "M" : "L"}${round(px + between(-0.5, 0.5))} ${round(py + between(-0.5, 0.5))}`,
					)
					.join(" "),
			)
			.join(" ");
		parts.push(
			`<path d="${d}" transform="translate(${round(x)} ${round(y)}) rotate(${round(angle)} ${round(5 * scale)} ${round(8 * scale)}) scale(${round(scale)})" stroke="${INK[randomInt(0, INK.length)]}" stroke-width="${round(between(1.1, 1.5))}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
		);
	});

	for (let i = 0; i < 3; i++) parts.push(noise());
	for (let i = 0; i < 40; i++) {
		parts.push(
			`<circle cx="${round(between(0, WIDTH))}" cy="${round(between(0, HEIGHT))}" r="${round(between(0.6, 1.6))}" fill="${INK[randomInt(0, INK.length)]}" opacity="0.5"/>`,
		);
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#f8fafc"/>${parts.join("")}</svg>`;
}
