function generateRandomNumber(max, min) {

	return Math.floor(Math.random() * max) + min;
}

function generateRandomNumberWithException(max, min, exception) {

	const randomNumber = generateRandomNumber(max, min);
	return (randomNumber == exception) ? generateRandomNumberWithException(min, max, exception) : randomNumber;
}

function pullFromWeightedTable(values) {

	const table = [];

	for (const i in values) {

		for (let j = 0; j < values[i]; j++) {

			table.push(parseInt(i, 10));
		}
	}

	return table[Math.floor(Math.random() * table.length)];
}

// Logistic/Sigmoid function
function generateWinChance(currentLevel, recommendedLevel) {

	// 1.58 is the x value where y reaches 50%
	const x = (currentLevel / (0.5 * recommendedLevel)) - 1.58;

	// 5.11 is the steepness level
	return 100 / (1 + Math.pow(Math.E, -5.11 * x));
}

module.exports = {
	generateRandomNumber: generateRandomNumber,
	generateRandomNumberWithException: generateRandomNumberWithException,
	pullFromWeightedTable: pullFromWeightedTable,
	generateWinChance: generateWinChance,
};
