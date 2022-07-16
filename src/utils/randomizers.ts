/**
 * Generates a random number between the minimum and the maximum which is the minimum + size - 1.
 * @param {number} size The amount of different numbers than can be generated.
 * @param {number} [minimum] The smallest number that can be generated. Default is 0.
 * @returns {number} A random number.
 */
export function generateRandomNumber(size: number, minimum?: number): number {

	return Math.floor(Math.random() * size) + (minimum ?? 0);
}

/**
 * Generates a random number between the minimum and the maximum which is the minimum + size - 1, except if the number is equal to the given exeption.
 * @param {number} size The amount of different numbers than can be generated.
 * @param {number} [minimum] The smallest number that can be generated. Default is 0.
 * @param {number} [exception] The number that cannot be generated. If none is given, this will be ignored.
 * @returns {number} A random number.
 */
export function generateRandomNumberWithException(size: number, minimum?: number, exception?: number): number {

	const randomNumber = generateRandomNumber(size, minimum);
	return (randomNumber === exception) ? generateRandomNumberWithException(size, minimum, exception) : randomNumber;
}

/**
 * Pulls a random weighted number, with the key being the returning number and the value being the weight its given.
 * @param {Object<number, number>} values Object of keys representing possible outcomes with values representing their weight. If the key is not a number, NaN might be returned in its place.
 * @returns {number} One of the object keys
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
 * @param {number} currentLevel
 * @param {number} recommendedLevel
 * @returns {number}
 */
export function generateWinChance(currentLevel: number, recommendedLevel: number): number {

	// 1.58 is the x value where y reaches 50%
	const x = (currentLevel / (0.5 * recommendedLevel)) - 1.58;

	// 5.11 is the steepness level
	return 100 / (1 + Math.pow(Math.E, -5.11 * x));
}