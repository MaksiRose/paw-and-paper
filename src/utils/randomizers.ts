/**
 * Generates a random number between the minimum and the maximum which is the minimum + size - 1.
 * @param size The amount of different numbers than can be generated. Must be 0 or higher.
 * @param [minimum] The smallest number that can be generated. Default is 0.
 * @returns A random number.
 */
function random(
	size: number,
	minimum = 0,
): number { return Math.floor(Math.random() * size) + minimum; }

/**
 * Generates a random number between the minimum and the maximum which is the minimum + size - 1, except if the number is equal to the given exeption.
 * @param size The amount of different numbers than can be generated. Must be 0 or higher.
 * @param [minimum] The smallest number that can be generated. Default is 0. Must be a safe integer.
 * @param [exception] The number that cannot be generated. If none is given, this will be ignored.
 * @returns A random number.
 */
export function getRandomNumber(
	size: number,
	minimum = 0,
	exception?: number,
): number {

	if (isNaN(size)) { throw new Error('size is not a number'); }
	if (!isFinite(size)) { throw new Error('size is infinite'); }
	if (size < 0) { throw new Error('size is below zero'); }

	if (isNaN(minimum)) { throw new Error('minimum is not a number'); }
	if (!isFinite(minimum)) { throw new Error('minimum is infinite'); }
	if (!Number.isSafeInteger(minimum)) { throw new Error('minimum is not a safe integer'); }

	if (exception !== undefined && isNaN(exception)) { throw new Error('exception is not a number'); }
	if (exception !== undefined && !isFinite(exception)) { throw new Error('exception is infinite'); }
	if (exception !== undefined && exception > (size + minimum - 1)) { throw new Error('exception is above range'); }
	if (exception !== undefined && exception < minimum) { throw new Error('exception is below range'); }

	if (exception === undefined) { return random(size, minimum); }
	const newSize1 = exception - minimum;
	const random1 = newSize1 > 0 ? random(newSize1, minimum) : undefined;
	const newSize2 = size - (exception - minimum) - 1;
	const random2 = newSize2 > 0 ? random(newSize2, exception + 1) : undefined;

	if (random1 !== undefined && random2 !== undefined) { return random(2) === 0 ? random1 : random2; }
	else if (random1 !== undefined) { return random1; }
	else if (random2 !== undefined) { return random2; }
	else { throw new Error('no number is available'); }
}

/**
 * Pulls a random weighted number, with the key being the returning number and the value being the weight its given.
 * @param values Object of keys representing possible outcomes with values representing their weight. If the key is not a number, NaN might be returned in its place.
 * @returns One of the object keys
 */
export function pullFromWeightedTable(
	values: { [n: string]: number; },
): number {

	const table: Array<number> = [];

	for (const i of Object.keys(values) as Array<keyof typeof values>) {

		for (let j = 0; j < (values[i] ?? 0); j++) { table.push(Number(i)); }
	}

	const returnNumber = table[getRandomNumber(table.length)];
	if (returnNumber === undefined) { throw new TypeError('returnNumber is undefined'); }
	return returnNumber;
}

/**
 * Logistic/Sigmoid function generating a win chance between 0 and 100.
 */
export function generateWinChance(
	currentLevel: number,
	recommendedLevel: number,
): number {

	// 1.58 is the x value where y reaches 50%
	const x = (currentLevel / (0.5 * recommendedLevel)) - 1.58;

	// 5.11 is the steepness level
	return 100 / (1 + Math.pow(Math.E, -5.11 * x));
}