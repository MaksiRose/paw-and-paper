const { profileModel, otherProfileModel } = require('../models/profileModel');

/**
 * It's updating all the accounts that are linked to the account that is being updated
 * @param {import('../typedef').ProfileSchema} profileData - The profile data that is being updated.
 * @param {Array<string>} [exceptionUUIDs] - The UUID of a profile that should not be in the profile list
 */
async function updateLinkedProfiles(profileData, exceptionUUIDs) {

	/* It's getting all the accounts that are linked to the account that is being updated. */
	const allAccounts = [
		.../** @type {Array<import('../typedef').ProfileSchema>} */ (await profileModel.find({
			userId: profileData.userId,
			$or: [
				{ uuid: profileData.linkedTo },
				{ linkedTo: profileData.uuid },
			],
		})),
		.../** @type {Array<import('../typedef').ProfileSchema>} */ (await otherProfileModel.find({
			userId: profileData.userId,
			$or: [
				{ uuid: profileData.linkedTo },
				{ linkedTo: profileData.uuid },
			],
		})),
	].filter(p => (Array.isArray(exceptionUUIDs) ? exceptionUUIDs : []).includes(p.uuid) === false);

	/* It's updating all the accounts that are linked to the account that is being updated. */
	for (let account of allAccounts) {

		account = /** @type {Array<import('../typedef').ProfileSchema>} */ (await profileModel.findOneAndUpdate(
			{ uuid: account.uuid },
			{
				$set: {
					name: profileData.name,
					description: profileData.description,
					color: profileData.color,
					avatarURL: profileData.avatarURL,
					pronounSets: profileData.pronounSets,
				},
			},
		)) || /** @type {Array<import('../typedef').ProfileSchema>} */ (await otherProfileModel.findOneAndUpdate(
			{ uuid: account.uuid },
			{
				$set: {
					name: profileData.name,
					description: profileData.description,
					color: profileData.color,
					avatarURL: profileData.avatarURL,
					pronounSets: profileData.pronounSets,
				},
			},
		));

		await updateLinkedProfiles(account, [...allAccounts.map(p => p.uuid), profileData.uuid, ...Array.isArray(exceptionUUIDs) ? exceptionUUIDs : []]);
	}
}

module.exports = updateLinkedProfiles;