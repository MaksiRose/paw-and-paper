// @ts-check
const { generateRandomNumber } = require('./randomizers');

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns it.
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {0 | 1 | 2 | 3 | 4 | 5} pronounNumber
 * @returns {string}
 */
function pronoun(profileData, pronounNumber) {

	const possiblePronouns = [];

	for (const pronounSet of profileData.pronounSets) {

		possiblePronouns.push(pronounSet[pronounNumber]);
	}

	return possiblePronouns[generateRandomNumber(possiblePronouns.length, 0)];
}

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns it in uppercase.
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {0 | 1 | 2 | 3 | 4 | 5} pronounNumber
 * @returns {string}
 */
function upperCasePronoun(profileData, pronounNumber) {

	const pronounString = pronoun(profileData, pronounNumber);

	return pronounString.charAt(0).toUpperCase() + pronounString.slice(1);
}

/**
 * Checks whether a pronoun comes from a set that is plural, and returns a boolean.
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {string} pronounString
 * @returns {boolean}
 */
function isPlural(profileData, pronounString) {

	for (const pronounSet of profileData.pronounSets) {

		if (pronounSet.includes(pronounString)) {

			return pronounSet[5] === 'singular' ? false : true;
		}
	}

	throw new Error(`${pronounString} is not in any pronoun set`);
}

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns with a string attached. If two strings are attached, the first one is attached if the pronoun is singular and second one is attached if the pronoun is plural. If no second string is attached, the first string is returned with an added s if the pronoun is singular, or returned as is if the pronoun is singular.
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {0 | 1 | 2 | 3 | 4 | 5} pronounNumber
 * @param {string} string1
 * @param {string | undefined} [string2]
 * @returns {string}
 */
function pronounAndPlural(profileData, pronounNumber, string1, string2) {

	const pronounString = pronoun(profileData, pronounNumber);

	if (string2 === undefined) {

		return `${pronounString} ${string1}${isPlural(profileData, pronounString) === false ? 's' : ''}`;
	}

	return `${pronounString} ${isPlural(profileData, pronounString) === false ? string1 : string2}`;
}

/**
 * Randomly selects the wanted pronoun from one of the users pronoun sets and returns in uppercase with a string attached. If two strings are attached, the first one is attached if the pronoun is singular and second one is attached if the pronoun is plural. If no second string is attached, the first string is returned with an added s if the pronoun is singular, or returned as is if the pronoun is singular.
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {0 | 1 | 2 | 3 | 4 | 5} pronounNumber
 * @param {string} string1
 * @param {string | undefined} [string2]
 * @returns {string}
 */
function upperCasePronounAndPlural(profileData, pronounNumber, string1, string2) {

	const normalPronoun = pronoun(profileData, pronounNumber);
	const pronounString = normalPronoun.charAt(0).toUpperCase() + normalPronoun.slice(1);

	if (string2 === undefined) {

		return `${pronounString} ${string1}${isPlural(profileData, normalPronoun) === false ? 's' : ''}`;
	}

	return `${pronounString} ${isPlural(profileData, normalPronoun) === false ? string1 : string2}`;
}

module.exports = {
	pronoun,
	upperCasePronoun,
	isPlural,
	pronounAndPlural,
	upperCasePronounAndPlural,
};