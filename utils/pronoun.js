const { generateRandomNumber } = require('./randomizers');

module.exports = (profileData, pronounNumber) => {

	const possiblePronouns = [];

	for (const pronounSet of profileData.pronounSets) {

		possiblePronouns.push(pronounSet[pronounNumber]);
	}

	return possiblePronouns[generateRandomNumber(possiblePronouns.length, 0)];
};