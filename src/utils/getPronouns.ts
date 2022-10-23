// import { UserData } from '../typings/data/user';
// import { capitalizeString, getArrayElement } from './helperFunctions';
// import { getRandomNumber } from './randomizers';

// /**
//  * Randomly selects the wanted pronoun from one of the users pronoun sets and returns it.
//  */
// export function pronoun(
// 	userData: UserData<true>,
// 	pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
// ): string {

// 	const possiblePronouns: Array<string> = [];

// 	for (const pronounSet of userData.quid.pronounSets) {

// 		const pronoun = pronounSet[pronounNumber];
// 		if (pronoun) { possiblePronouns.push(pronoun); }
// 	}

// 	return getArrayElement(possiblePronouns, getRandomNumber(possiblePronouns.length));
// }

// /**
//  * Randomly selects the wanted pronoun from one of the users pronoun sets and returns it in uppercase.
//  */
// export function upperCasePronoun(
// 	userData: UserData<true>,
// 	pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
// ): string {

// 	const pronounString = pronoun(userData, pronounNumber);

// 	return capitalizeString(pronounString);
// }

// /**
//  * Checks whether a pronoun comes from a set that is plural, and returns a boolean.
//  */
// export function isPlural(
// 	userData: UserData<true>,
// 	pronounString: string,
// ): boolean {

// 	for (const pronounSet of userData.quid.pronounSets) {

// 		if (pronounSet.includes(pronounString)) { return pronounSet[5] === 'singular' ? false : true; }
// 	}

// 	throw new Error(`${pronounString} is not in any pronoun set`);
// }

// /**
//  * Randomly selects the wanted pronoun from one of the users pronoun sets and returns with a string attached. If two strings are attached, the first one is attached if the pronoun is singular and second one is attached if the pronoun is plural. If no second string is attached, the first string is returned with an added s if the pronoun is singular, or returned as is if the pronoun is singular.
//  */
// export function pronounAndPlural(
// 	userData: UserData<true>,
// 	pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
// 	string1: string,
// 	string2?: string,
// ): string {

// 	const pronounString = pronoun(userData, pronounNumber);

// 	if (string2 === undefined) { return `${pronounString} ${string1}${isPlural(userData, pronounString) === false ? 's' : ''}`; }
// 	return `${pronounString} ${isPlural(userData, pronounString) === false ? string1 : string2}`;
// }

// /**
//  * Randomly selects the wanted pronoun from one of the users pronoun sets and returns in uppercase with a string attached. If two strings are attached, the first one is attached if the pronoun is singular and second one is attached if the pronoun is plural. If no second string is attached, the first string is returned with an added s if the pronoun is singular, or returned as is if the pronoun is singular.
//  */
// export function upperCasePronounAndPlural(
// 	userData: UserData<true>,
// 	pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
// 	string1: string,
// 	string2?: string,
// ): string {

// 	const normalPronoun = pronoun(userData, pronounNumber);
// 	const pronounString = capitalizeString(normalPronoun);

// 	if (string2 === undefined) { return `${pronounString} ${string1}${isPlural(userData, normalPronoun) === false ? 's' : ''}`; }
// 	return `${pronounString} ${isPlural(userData, normalPronoun) === false ? string1 : string2}`;
// }