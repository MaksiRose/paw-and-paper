// @ts-check
const { generateRandomNumber } = require('./randomizers');

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns it.
 * @param {import('../typedef').Character} characterData
 * @param {0 | 1 | 2 | 3 | 4 | 5} pronounNumber
 * @returns {string}
 */
function pronoun(characterData, pronounNumber) {

	const possiblePronouns = [];

	for (const pronounSet of characterData.pronounSets) {

		possiblePronouns.push(pronounSet[pronounNumber]);
	}

	return possiblePronouns[generateRandomNumber(possiblePronouns.length, 0)];
}

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns it in uppercase.
 * @param {import('../typedef').Character} characterData
 * @param {0 | 1 | 2 | 3 | 4 | 5} pronounNumber
 * @returns {string}
 */
function upperCasePronoun(characterData, pronounNumber) {

	const pronounString = pronoun(characterData, pronounNumber);

	return pronounString.charAt(0).toUpperCase() + pronounString.slice(1);
}

/**
 * Checks whether a pronoun comes from a set that is plural, and returns a boolean.
 * @param {import('../typedef').Character} characterData
 * @param {string} pronounString
 * @returns {boolean}
 */
function isPlural(characterData, pronounString) {

	for (const pronounSet of characterData.pronounSets) {

		if (pronounSet.includes(pronounString)) {

			return pronounSet[5] === 'singular' ? false : true;
		}
	}

	throw new Error(`${pronounString} is not in any pronoun set`);
}

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns with a string attached. If two strings are attached, the first one is attached if the pronoun is singular and second one is attached if the pronoun is plural. If no second string is attached, the first string is returned with an added s if the pronoun is singular, or returned as is if the pronoun is singular.
 * @param {import('../typedef').Character} characterData
 * @param {0 | 1 | 2 | 3 | 4 | 5} pronounNumber
 * @param {string} string1
 * @param {string | undefined} [string2]
 * @returns {string}
 */
function pronounAndPlural(characterData, pronounNumber, string1, string2) {

	const pronounString = pronoun(characterData, pronounNumber);

	if (string2 === undefined) {

		return `${pronounString} ${string1}${isPlural(characterData, pronounString) === false ? 's' : ''}`;
	}

	return `${pronounString} ${isPlural(characterData, pronounString) === false ? string1 : string2}`;
}

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns in uppercase with a string attached. If two strings are attached, the first one is attached if the pronoun is singular and second one is attached if the pronoun is plural. If no second string is attached, the first string is returned with an added s if the pronoun is singular, or returned as is if the pronoun is singular.
 * @param {import('../typedef').Character} charaterData
 * @param {0 | 1 | 2 | 3 | 4 | 5} pronounNumber
 * @param {string} string1
 * @param {string | undefined} [string2]
 * @returns {string}
 */
function upperCasePronounAndPlural(charaterData, pronounNumber, string1, string2) {

	const normalPronoun = pronoun(charaterData, pronounNumber);
	const pronounString = normalPronoun.charAt(0).toUpperCase() + normalPronoun.slice(1);

	if (string2 === undefined) {

		return `${pronounString} ${string1}${isPlural(charaterData, normalPronoun) === false ? 's' : ''}`;
	}

	return `${pronounString} ${isPlural(charaterData, normalPronoun) === false ? string1 : string2}`;
}

module.exports = {
	pronoun,
	upperCasePronoun,
	isPlural,
	pronounAndPlural,
	upperCasePronounAndPlural,
};