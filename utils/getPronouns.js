const { generateRandomNumber } = require('./randomizers');

module.exports = {
	pronoun(profileData, pronounNumber) {

		const possiblePronouns = [];

		for (const pronounSet of profileData.pronounSets) {

			possiblePronouns.push(pronounSet[pronounNumber]);
		}

		return possiblePronouns[generateRandomNumber(possiblePronouns.length, 0)];
	},
	upperCasePronoun(profileData, pronounNumber) {

		const pronoun = module.exports.pronoun(profileData, pronounNumber);

		return pronoun.charAt(0).toUpperCase() + pronoun.slice(1);
	},
	isPlural(profileData, pronoun) {

		for (const pronounSet of profileData.pronounSets) {

			if (pronounSet.includes(pronoun)) {

				return pronounSet[5] === 'singular' ? false : true;
			}
		}

		return undefined;
	},
	pronounAndPlural(profileData, pronounNumber, extraWord1, extraWord2) {

		const pronoun = module.exports.pronoun(profileData, pronounNumber);

		if (extraWord2 === undefined) {

			return `${pronoun} ${extraWord1}${module.exports.isPlural(profileData, pronoun) === false ? 's' : ''}`;
		}

		return `${pronoun} ${module.exports.isPlural(profileData, pronoun) === false ? extraWord1 : extraWord2}`;
	},
	upperCasePronounAndPlural(profileData, pronounNumber, extraWord1, extraWord2) {

		const pronoun = module.exports.upperCasePronoun(profileData, pronounNumber);

		if (extraWord2 === undefined) {

			return `${pronoun} ${extraWord1}${module.exports.isPlural(profileData, pronoun) === false ? 's' : ''}`;
		}

		return `${pronoun} ${module.exports.isPlural(profileData, pronoun) === false ? extraWord1 : extraWord2}`;
	},
};