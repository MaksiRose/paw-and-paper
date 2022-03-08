const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'stats',
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		const components = [{
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'stats-refresh',
				emoji: { name: '🔁' },
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'profile-store',
				label: 'Store food away',
				style: 'SECONDARY',
			}],
		}];

		if (Object.values(profileData.inventoryObject).map(itemType => Object.values(itemType)).flat().filter(amount => amount > 0).length == 0) {

			components[0].components.pop();
		}

		let injuryText = (Object.values(profileData.injuryObject).every(item => item == 0)) ? null : '';

		for (const [injuryKey, injuryAmount] of Object.entries(profileData.injuryObject)) {

			if (injuryAmount > 0) {

				if (typeof injuryAmount === 'number') {

					injuryText += `, ${injuryAmount} ${(injuryAmount < 2) ? injuryKey.slice(0, -1) : injuryKey}`;
				}
				else {

					injuryText += `${injuryKey}: yes\n`;
				}
			}
		}

		return await message
			.reply({
				content: `🚩 Levels: \`${profileData.levels}\` - ✨ XP: \`${profileData.experience}/${profileData.levels * 50}\`\n❤️ Health: \`${profileData.health}/${profileData.maxHealth}\` - ⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\` - 🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\`${(injuryText == null) ? '' : `🩹 Injuries/Illnesses: ${injuryText.slice(2)}`}`,
				components: components,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};