import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js';
import { sendReminder, stopReminder } from '../commands/gameplay_maintenance/water-tree';
import userModel from '../models/userModel';
import { UserSchema } from '../typedef';
import { respond, update } from './helperFunctions';

export default async function settingsInteractionCollector(
	interaction: ButtonInteraction,
	userData: UserSchema | null,
): Promise<void> {

	if (interaction.customId.includes('reminders')) {

		if (userData === null) { throw new TypeError('userData is null'); }
		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }

		const isOn = interaction.customId.includes('on');

		if (interaction.customId.includes('water')) {

			userData = await userModel.findOneAndUpdate(
				u => u._id === userData?._id,
				(u) => {
					u.settings.reminders.water = isOn;
				},
			);

			/* This executes the sendReminder function for each profile for which the sapling exists and where lastMessageChannelId is a string, if the user has enabled water reminders. */
			if (userData.settings.reminders.water === true) {

				for (const quid of Object.values(userData.quids)) {

					for (const profile of Object.values(quid.profiles)) {

						if (isOn) {

							if (profile.sapling.exists && typeof profile.sapling.lastMessageChannelId === 'string' && !profile.sapling.sentReminder) { sendReminder(userData, quid, profile); }
						}
						else { stopReminder(quid._id, interaction.guildId); }
					}
				}
			}

			await update(interaction, {
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(`settings_reminders_water_${isOn ? 'off' : 'on'}_@${userData._id}`)
						.setLabel(`Turn water reminders ${isOn ? 'off' : 'on'}`)
						.setStyle(ButtonStyle.Secondary))],
			});

			await respond(interaction, {
				content: `You turned reminders for watering ${isOn ? 'on' : 'off'}!`,
				ephemeral: true,
			}, false);
		}

		if (interaction.customId.includes('resting')) {

			userData = await userModel.findOneAndUpdate(
				u => u._id === userData?._id,
				(u) => {
					u.settings.reminders.resting = isOn;
				},
			);

			await update(interaction, {
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(`settings_reminders_resting_${isOn ? 'off' : 'on'}_@${userData._id}`)
						.setLabel(`Turn automatic resting pings ${isOn ? 'off' : 'on'}`)
						.setStyle(ButtonStyle.Secondary))],
			});

			await respond(interaction, {
				content: `You turned pings for automatic resting ${isOn ? 'on' : 'off'}!`,
				ephemeral: true,
			}, false);
		}
	}
}