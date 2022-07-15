import { APIMessage } from 'discord-api-types/v9';
import { CommandInteraction, Interaction, InteractionReplyOptions, Message, MessageContextMenuInteraction, MessagePayload, WebhookEditMessageOptions } from 'discord.js';
import serverModel from '../models/serverModel';
import userModel from '../models/userModel';
import { CustomClient, Event } from '../typedef';
import { activeCommandsObject } from '../utils/commandCollector';
import { pronoun, pronounAndPlural } from '../utils/getPronouns';
import { createGuild } from '../utils/updateGuild';
const { version } = require('../../package.json');

export const hasCooldownMap: Map<string, boolean> = new Map();
export const lastInteractionTimestampMap: Map<string, number> = new Map();

export const event: Event = {
	name: 'interactionCreate',
	once: false,
	async execute(client: CustomClient, interaction: Interaction) {

		/* This is only null when in DM without CHANNEL partial */
		if (!interaction.channel) { throw new Error('Interaction channel cannot be found.'); }

		let userData = await userModel.findOne({ userId: interaction.user.id }).catch(() => { return null; });
		let serverData = await serverModel.findOne({ serverId: interaction.guildId || '' }).catch(() => { return null; });

		/* It's setting the last interaction timestamp for the user to now. */
		if (userData) { lastInteractionTimestampMap.set(userData.uuid + interaction.guildId, Date.now()); }

		/* Checking if the serverData is null. If it is null, it will create a guild. */
		if (!serverData && interaction.inCachedGuild()) {

			serverData = await createGuild(client, interaction.guild);
		}

		if (interaction.isRepliable() && interaction.inRawGuild()) {

			await interaction
				.reply({
					content: 'Oops, I am missing the `bot` scope that is normally part of the invite link. Please re-invite the bot!',
					ephemeral: true,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		if (interaction.isAutocomplete()) {

			/**
			 * https://discordjs.guide/interactions/autocomplete.html#responding-to-autocomplete-interactions
			 */

			/* Getting the command from the client and checking if the command is undefined.
			If it is, it will error. */
			const command = client.slashCommands[interaction.commandName];
			if (command === undefined || !Object.hasOwn(command, 'sendAutocomplete')) { return; }

			/* It's sending the autocomplete message. */
			await command.sendAutocomplete?.(client, interaction, userData, serverData);
			return;
		}

		if (interaction.isCommand()) {

			/* Getting the command from the client and checking if the command is undefined.
			If it is, it will error. */
			const command = client.slashCommands[interaction.commandName];
			if (command === undefined || !Object.hasOwn(command, 'sendCommand')) {

				return await sendErrorMessage(interaction, new Error('Unknown command'));
			}

			/* It's setting the cooldown to false for the user. */
			if (userData) { hasCooldownMap.set(userData.uuid + interaction.guildId, false); }

			/* It's disabling all components if userData exists, the interaction is in a guild and the command is set to disable a previous command. */
			if (userData && interaction.inGuild() && command.disablePreviousCommand) {

				await activeCommandsObject[userData.uuid + interaction.guildId]();
			}

			/* This sends the command and error message if an error occurs. */
			console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully executed \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			await command
				.sendCommand(client, interaction, userData, serverData, [])
				.catch(async (error) => { await sendErrorMessage(interaction, error); });

			if (interaction.inGuild()) {

				userData = await userModel.findOne({ userId: interaction.user.id }).catch(() => { return null; });
				const characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guildId]];
				const profileData = characterData?.profiles?.[interaction.guildId];

				/* If sapling exists, a gentle reminder has not been sent and the watering time is after the perfect time, send a gentle reminder */
				if (userData && profileData && profileData.sapling.exists && !profileData.sapling?.sentGentleReminder && Date.now() > (profileData.sapling.nextWaterTimestamp || 0)) {

					await userModel.findOneAndUpdate(
						{ uuid: userData.uuid },
						(u) => {
							u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].sapling.sentGentleReminder = true;
						},
					);

					await interaction
						.followUp({
							embeds: [{
								color: characterData.color,
								author: { name: characterData.name, icon_url: characterData.avatarURL },
								description: `*Engrossed in ${pronoun(characterData, 2)} work, ${characterData.name} suddenly remembers that ${pronounAndPlural(characterData, 0, 'has', 'have')} not yet watered ${pronoun(characterData, 2)} plant today. The ${characterData.displayedSpecies || characterData.species} should really do it soon!*`,
								footer: { text: 'Type "rp water" to water your ginkgo sapling!' },
							}],
						})
						.catch(async (error) => {
							return await sendErrorMessage(interaction, error);
						});
				}
			}

			/* This is checking if the user has used the bot since the last update. If they haven't, it will
			send them a message telling them that there is a new update. */
			if (Number(userData?.lastPlayedVersion) < Number(version.split('.').slice(0, -1).join('.'))) {

				await interaction
					.followUp({
						content: `A new update has come out since you last used the bot! You can view the changelog here: <https://github.com/MaksiRose/paw-and-paper/releases/tag/v${version.split('.').slice(0, -1).join('.')}.0>`,
					})
					.catch(async (error) => {
						return await sendErrorMessage(interaction, error);
					});

				await userModel.findOneAndUpdate(
					{ userId: interaction.user.id },
					(u) => {
						u.lastPlayedVersion = version.split('.').slice(0, -1).join('.');
					},
				);
			}
			return;
		}

		if (interaction.isMessageContextMenu()) {

			/* Getting the command from the client and checking if the command is undefined.
			If it is, it will error. */
			const command = client.contextMenuCommands[interaction.commandName];
			if (command === undefined || !Object.hasOwn(command, 'sendCommand')) {

				return await sendErrorMessage(interaction, new Error('Unknown command'));
			}

			/* This sends the command and error message if an error occurs. */
			console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully executed \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			await command
				.sendCommand(client, interaction)
				.catch(async (error) => { await sendErrorMessage(interaction, error); });
			return;
		}
	},
};

export const respond = async (interaction: CommandInteraction | MessageContextMenuInteraction, options: MessagePayload | WebhookEditMessageOptions | InteractionReplyOptions, editMessage: boolean): Promise<Message<boolean>> => {
	let botReply: APIMessage | Message<boolean>;
	if (!interaction.replied) {
		botReply = await interaction.reply(options && { fetchReply: true });
	}
	else if (editMessage) {
		botReply = await interaction.editReply(options);
	}
	else {
		botReply = await interaction.followUp(options);
	}

	if (botReply instanceof Message) { return botReply; }
	else { throw new Error('Message is APIMessage'); }
};

setInterval(async function() {

	const userArray = await userModel.find();
	for (const user of userArray) {

		const currentCharacters = user.currentCharacter;
		for (const [serverId, characterId] of Object.values(currentCharacters)) {

			const activeProfile = user.characters[characterId].profiles[serverId];
			const tenMinutesInMs = 600_000;

			const lastInteractionIsTenMinutesAgo = (lastInteractionTimestampMap.get(user.uuid + serverId) || 0) < Date.now() - tenMinutesInMs;
			const hasLessThanMaxEnergy = activeProfile.energy < activeProfile.maxEnergy;
			const isConscious = activeProfile.energy > 0 || activeProfile.health > 0 || activeProfile.hunger > 0 || activeProfile.thirst > 0;
			if (lastInteractionIsTenMinutesAgo && !activeProfile.isResting && hasLessThanMaxEnergy && isConscious) {

				// trigger rest command here
			}
		}
	}
}, 60_000);

async function sendErrorMessage(interaction: CommandInteraction | MessageContextMenuInteraction, error: any) {

	console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m unsuccessfully tried to execute \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	console.error(error);

	// "Reply" can't be used here in case the interaction is already responded to. A new "respond" method should be added to the interaction as an extended class/type, which would default to replying to an interaction, and a second argument would decide whether "editReply" or "followUp" would act as a replacement
	await respond(interaction, {
		embeds: [{
			title: 'There was an unexpected error executing this command:',
			description: `\`\`\`${error?.message || String(error).substring(0, 4090)}\`\`\``,
			footer: { text: 'If this is the first time you encountered the issue, please report it using the button below. After that, only report it again if the issue was supposed to be fixed after an update came out. To receive updates, ask a server administrator to do the "getupdates" command.' },
		}],
		components: [{
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'report',
				label: 'Report',
				style: 'SUCCESS',
			}],
		}],
	}, false)
		.catch((newError) => {
			console.error(newError);
		});
}