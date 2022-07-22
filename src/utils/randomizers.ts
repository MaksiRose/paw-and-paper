/**
 * Generates a random number between the minimum and the maximum which is the minimum + size - 1.
 * @param size The amount of different numbers than can be generated.
 * @param [minimum] The smallest number that can be generated. Default is 0.
 * @returns A random number.
 */
export function generateRandomNumber(size: number, minimum = 0): number {

	return Math.floor(Math.random() * size) + minimum;
}

/**
 * Generates a random number between the minimum and the maximum which is the minimum + size - 1, except if the number is equal to the given exeption.
 * @param size The amount of different numbers than can be generated.
 * @param [minimum] The smallest number that can be generated. Default is 0.
 * @param [exception] The number that cannot be generated. If none is given, this will be ignored.
 * @returns A random number.
 */
export function generateRandomNumberWithException(size: number, minimum = 0, exception?: number): number {

	const randomNumber = generateRandomNumber(size, minimum);
	return (randomNumber === exception) ? generateRandomNumberWithException(size, minimum, exception) : randomNumber;
}

/**
 * Pulls a random weighted number, with the key being the returning number and the value being the weight its given.
 * @param values Object of keys representing possible outcomes with values representing their weight. If the key is not a number, NaN might be returned in its place.
 * @returns One of the object keys
 */
export function pullFromWeightedTable(values: { [n: number]: number; }): number {

	const table: Array<number> = [];

	for (const i of Object.keys(values)) {

		for (let j = 0; j < values[i]; j++) {

			table.push(Number(i));
		}
	}

	return table[generateRandomNumber(table.length)];
}

/**
 * Logistic/Sigmoid function generating a win chance between 0 and 100.
 */
export function generateWinChance(currentLevel: number, recommendedLevel: number): number {

	// 1.58 is the x value where y reaches 50%
	const x = (currentLevel / (0.5 * recommendedLevel)) - 1.58;

	// 5.11 is the steepness level
	return 100 / (1 + Math.pow(Math.E, -5.11 * x));
}