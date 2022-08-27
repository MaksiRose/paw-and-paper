import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js';
import { sendReminder, stopReminder } from '../commands/gameplay_maintenance/water-tree';
import userModel from '../models/userModel';
import { CustomClient, UserSchema } from '../typedef';
import { getMapData, respond } from './helperFunctions';

export default async function settingsInteractionCollector(
	client: CustomClient,
	interaction: ButtonInteraction,
	userData: UserSchema | null,
): Promise<void> {

	if (interaction.customId.includes('reminders')) {

		if (!userData) { throw new TypeError('userData is null'); }
		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);

		const isOn = interaction.customId.includes('on');

		if (interaction.customId.includes('water')) {

			userData = await userModel.findOneAndUpdate(
				u => u.uuid === userData?.uuid,
				(u) => {
					u.settings.reminders.water = isOn;
				},
			);

			if (isOn) { sendReminder(client, userData, quidData, profileData); }
			else { stopReminder(quidData._id, interaction.user.id, interaction.guildId); }

			await interaction
				.update({
					components: [new ActionRowBuilder<ButtonBuilder>()
						.setComponents(new ButtonBuilder()
							.setCustomId(`settings_reminders_water_${isOn ? 'off' : 'on'}`)
							.setLabel(`Turn water reminders ${isOn ? 'off' : 'on'}`)
							.setStyle(ButtonStyle.Secondary))],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			await respond(interaction, {
				content: `You turned reminders for watering ${isOn ? 'on' : 'off'}!`,
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (interaction.customId.includes('resting')) {

			userData = await userModel.findOneAndUpdate(
				u => u.uuid === userData?.uuid,
				(u) => {
					u.settings.reminders.resting = isOn;
				},
			);

			await interaction
				.update({
					components: [new ActionRowBuilder<ButtonBuilder>()
						.setComponents(new ButtonBuilder()
							.setCustomId(`settings_reminders_resting_${isOn ? 'off' : 'on'}`)
							.setLabel(`Turn automatic resting pings ${isOn ? 'off' : 'on'}`)
							.setStyle(ButtonStyle.Secondary))],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			await respond(interaction, {
				content: `You turned pings for automatic resting ${isOn ? 'on' : 'off'}!`,
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}
	}
}