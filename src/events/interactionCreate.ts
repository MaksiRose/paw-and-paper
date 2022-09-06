import { CommandInteraction, EmbedBuilder, Interaction, MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js';
import { deleteInteractionCollector } from '../commands/quid_customization/delete';
import { profileInteractionCollector } from '../commands/quid_customization/profile';
import { pronounsInteractionCollector, sendEditPronounsModalResponse } from '../commands/quid_customization/pronouns';
import { proxyInteractionCollector, sendEditProxyModalResponse } from '../commands/quid_customization/proxy';
import { sendEditDisplayedSpeciesModalResponse, speciesInteractionCollector } from '../commands/quid_customization/species';
import { friendshipsInteractionCollector } from '../commands/interaction/friendships';
import { hugInteractionCollector } from '../commands/interaction/hug';
import { sendEditSkillsModalResponse, skillsInteractionCollector } from '../commands/interaction/skills';
import { helpInteractionCollector } from '../commands/miscellaneous/help';
import { serversettingsInteractionCollector } from '../commands/miscellaneous/server-settings';
import { shopInteractionCollector } from '../commands/miscellaneous/shop';
import { createNewTicket, sendRespondToTicketModalResponse, ticketInteractionCollector } from '../commands/miscellaneous/ticket';
import { sendEditMessageModalResponse } from '../contextmenu/edit';
import serverModel from '../models/serverModel';
import userModel from '../models/userModel';
import { ErrorStacks, Event } from '../typedef';
import { disableCommandComponent, disableAllComponents } from '../utils/componentDisabling';
import { getMapData, update } from '../utils/helperFunctions';
import { pronoun, pronounAndPlural } from '../utils/getPronouns';
import { createGuild } from '../utils/updateGuild';
import { respond } from '../utils/helperFunctions';
import { sendErrorMessage } from '../utils/helperFunctions';
import { adventureInteractionCollector } from '../commands/interaction/adventure';
import { playfightInteractionCollector } from '../commands/interaction/playfight';
import { generateId } from 'crystalid';
import { readFileSync, writeFileSync } from 'fs';
import { profilelistInteractionCollector } from '../commands/interaction/profilelist';
import { startResting } from '../commands/gameplay_maintenance/rest';
import { statsInteractionCollector } from '../commands/gameplay_maintenance/stats';
import settingsInteractionCollector from '../utils/settingsInteractionCollector';
import { storeInteractionCollector } from '../commands/gameplay_maintenance/store';
import { inventoryInteractionCollector } from '../commands/gameplay_maintenance/inventory';
import { voteInteractionCollector } from '../commands/gameplay_maintenance/vote';
import { repairInteractionCollector } from '../commands/gameplay_maintenance/repair';
import { healInteractionCollector } from '../commands/gameplay_maintenance/heal';
import { rankupInteractionCollector } from '../commands/gameplay_primary/rank-up';
import { executeScavenging, command as scavengeCommand } from '../commands/gameplay_primary/scavenge';
import { travelInteractionCollector } from '../commands/gameplay_primary/travel-regions';
const { version } = require('../../package.json');
const { error_color } = require('../../config.json');

export const cooldownMap: Map<string, boolean> = new Map();
export const lastInteractionMap: Map<string, CommandInteraction<'cached'> | MessageComponentInteraction<'cached'> | ModalSubmitInteraction<'cached'>> = new Map();
export const serverActiveUsersMap: Map<string, string[]> = new Map();

export const event: Event = {
	name: 'interactionCreate',
	once: false,
	async execute(client, interaction: Interaction) {

		/* This is only null when in DM without CHANNEL partial, or when channel cache is sweeped. Therefore, this is technically unsafe since this value could become null after this check. This scenario is unlikely though. */
		if (!interaction.channel) {

			await client.channels.fetch(interaction.channelId || '')
				.catch(() => { throw new Error('Interaction channel cannot be found.'); });
		}

		let userData = await userModel.findOne(u => u.userId.includes(interaction.user.id)).catch(() => { return null; });
		let serverData = await serverModel.findOne(s => s.serverId === interaction.guildId).catch(() => { return null; });

		/* It's setting the last interaction timestamp for the user to now. */
		if (userData && interaction.inCachedGuild() && (interaction.isRepliable() && !interaction.isAutocomplete())) { // For some reason autocompleteInteraction is not excluded despite being

			lastInteractionMap.set(userData.uuid + interaction.guildId, interaction);

			const serverActiveUsers = serverActiveUsersMap.get(interaction.guildId);
			if (!serverActiveUsers) { serverActiveUsersMap.set(interaction.guildId, [interaction.user.id]); }
			else { serverActiveUsers.push(interaction.user.id); }
		}

		/* Checking if the serverData is null. If it is null, it will create a guild. */
		if (!serverData && interaction.inCachedGuild()) {

			serverData = await createGuild(client, interaction.guild)
				.catch(async (error) => {
					console.error(error);
					if (interaction.isRepliable() && !interaction.isAutocomplete()) { await sendErrorMessage(interaction, new Error('Unknown command')); }
					return null;
				});
		}

		if (interaction.isRepliable() && interaction.inRawGuild()) {

			await interaction
				.reply({
					content: 'Oops, I am missing the `bot` scope that is normally part of the invite link. Please re-invite the bot!',
					ephemeral: true,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { console.error(error); }
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
			await command.sendAutocomplete?.(client, interaction, userData, serverData)
				.catch(async (error) => { console.error(error); });
			return;
		}

		if (interaction.isChatInputCommand()) {

			/* Getting the command from the client and checking if the command is undefined.
			If it is, it will error. */
			const command = client.slashCommands[interaction.commandName];
			if (command === undefined || !Object.hasOwn(command, 'sendCommand')) {

				return await sendErrorMessage(interaction, new Error('Unknown command'));
			}

			/* If the user is not registered in the cooldown map, it's setting the cooldown to false for the user. */
			if (userData && interaction.guildId && !cooldownMap.has(userData.uuid + interaction.guildId)) { cooldownMap.set(userData.uuid + interaction.guildId, false); }

			/* It's disabling all components if userData exists and the command is set to disable a previous command. */
			if (userData && command.disablePreviousCommand) { await disableCommandComponent[userData.uuid + (interaction.guildId || 'DM')]?.(); }

			/* This sends the command and error message if an error occurs. */
			console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully executed \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			await command
				.sendCommand(client, interaction, userData, serverData, [])
				.catch(async (error) => { await sendErrorMessage(interaction, error); });

			if (interaction.inGuild()) {

				userData = await userModel.findOne(u => u.userId.includes(interaction.user.id)).catch(() => { return null; });
				const quidData = userData?.quids?.[userData?.currentQuid?.[interaction.guildId] || ''];
				const profileData = quidData?.profiles?.[interaction.guildId];

				/* If sapling exists, a gentle reminder has not been sent and the watering time is after the perfect time, send a gentle reminder */
				if (userData && profileData && profileData.sapling.exists && !profileData.sapling?.sentGentleReminder && Date.now() > (profileData.sapling.nextWaterTimestamp || 0)) {

					await userModel.findOneAndUpdate(
						u => u.uuid === userData?.uuid,
						(u) => {
							const p = getMapData(getMapData(u.quids, quidData._id).profiles, interaction.guildId);
							p.sapling.sentGentleReminder = true;
						},
					);

					await interaction
						.followUp({
							embeds: [new EmbedBuilder()
								.setColor(quidData.color)
								.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
								.setDescription(`*Engrossed in ${pronoun(quidData, 2)} work, ${quidData.name} suddenly remembers that ${pronounAndPlural(quidData, 0, 'has', 'have')} not yet watered ${pronoun(quidData, 2)} plant today. The ${quidData.displayedSpecies || quidData.species} should really do it soon!*`)
								.setFooter({ text: 'Type "/water" to water your ginkgo sapling!' })],
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
					u => u.userId.includes(interaction.user.id),
					(u) => {
						u.lastPlayedVersion = version.split('.').slice(0, -1).join('.');
					},
				);
			}
			return;
		}

		if (interaction.isUserContextMenuCommand()) { return; }

		if (interaction.isMessageContextMenuCommand()) {

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

		if (interaction.isModalSubmit()) {

			console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully submitted the modal \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (interaction.customId.includes('edit')) {

				await sendEditMessageModalResponse(interaction)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.includes('species')) {

				await sendEditDisplayedSpeciesModalResponse(interaction, userData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.includes('pronouns')) {

				await sendEditPronounsModalResponse(interaction)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.includes('proxy')) {

				await sendEditProxyModalResponse(interaction, userData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.includes('ticket') && interaction.isFromMessage()) {

				await sendRespondToTicketModalResponse(interaction)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.includes('skills') && interaction.isFromMessage()) {

				await sendEditSkillsModalResponse(interaction, serverData, userData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}
			return;
		}

		if (interaction.isMessageComponent()) {

			/* It's checking if the user that created the command is the same as the user that is interacting with the command, or if the user that is interacting is mentioned in the interaction.customId. If neither is true, it will send an error message. */
			const isNotCommandCreator = interaction.message.interaction && interaction.message.interaction.user.id !== interaction.user.id;
			const isMentioned = interaction.customId.includes(userData?.uuid || interaction.user.id || 'ANYONECANCLICK');
			if (isNotCommandCreator && !isMentioned) {

				await respond(interaction, {
					content: 'Sorry, I only listen to the person that created the command 😣',
					ephemeral: true,
				}, false)
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							return await sendErrorMessage(interaction, error);
						}
					});
				return;
			}

			if (interaction.isSelectMenu()) {

				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully selected \x1b[31m${interaction.values[0]} \x1b[0mfrom the menu \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

				if (interaction.customId.startsWith('help_')) {

					await helpInteractionCollector(client, interaction)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.startsWith('shop_')) {

					await shopInteractionCollector(interaction, userData, serverData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.startsWith('inventory_')) {

					await inventoryInteractionCollector(interaction, userData, serverData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.startsWith('vote_')) {

					await voteInteractionCollector(client, interaction, userData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}
			}

			if (interaction.isButton()) {

				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully clicked the button \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

				if (interaction.customId.startsWith('report_')) {

					await update(interaction, {
						components: disableAllComponents(interaction.message.components.map(component => component.toJSON())),
					})
						.catch((error) => { console.error(error); });

					const errorId = interaction.customId.split('_')[2] || generateId();
					const errorStacks = JSON.parse(readFileSync('./database/errorStacks.json', 'utf-8')) as ErrorStacks;
					const description = errorStacks[errorId] ? `\`\`\`${errorStacks[errorId]!.substring(0, 4090)}\`\`\`` : interaction.message.embeds[0]?.description;

					if (!description) {

						await respond(interaction, {
							embeds: [new EmbedBuilder()
								.setColor(error_color)
								.setDescription('There was an error trying to report the error... Ironic! Maybe you can try opening a ticket via `/ticket` instead?')],
							ephemeral: true,
						}, false)
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
							});
						return;
					}

					await createNewTicket(client, interaction, `Error ${errorId}`, description, 'bug', null, errorId);
					delete errorStacks[errorId];
					writeFileSync('./database/errorStacks.json', JSON.stringify(errorStacks, null, '\t'));
				}

				if (interaction.customId.startsWith('ticket_')) {

					await ticketInteractionCollector(interaction)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.startsWith('hug_')) {

					await hugInteractionCollector(interaction, userData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.startsWith('friendships_')) {

					await friendshipsInteractionCollector(interaction, userData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.startsWith('adventure_')) {

					await adventureInteractionCollector(interaction, serverData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.startsWith('playfight_')) {

					await playfightInteractionCollector(interaction, serverData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.startsWith('stats_')) {

					await statsInteractionCollector(interaction, userData, serverData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.includes('settings_')) {

					await settingsInteractionCollector(client, interaction, userData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId.includes('rank_')) {

					await rankupInteractionCollector(interaction, userData, serverData)
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}

				if (interaction.customId === 'scavenge_new') {

					/* It's disabling all components if userData exists and the command is set to disable a previous command. */

					if (userData && scavengeCommand.disablePreviousCommand) { await disableCommandComponent[userData.uuid + (interaction.guildId || 'DM')]?.(); }

					await executeScavenging(interaction, userData, serverData, [])
						.catch(async (error) => { await sendErrorMessage(interaction, error); });
					return;
				}
			}

			if (interaction.customId.startsWith('profile_')) {

				await profileInteractionCollector(client, interaction)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('species_')) {

				await speciesInteractionCollector(interaction, userData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('pronouns_')) {

				await pronounsInteractionCollector(interaction)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('proxy_')) {

				await proxyInteractionCollector(interaction, userData, serverData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('delete_')) {

				await deleteInteractionCollector(interaction, userData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('serversettings_')) {

				if (!serverData) { return await sendErrorMessage(interaction, new Error('serverData is null')); }
				await serversettingsInteractionCollector(interaction, serverData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('skills_')) {

				await skillsInteractionCollector(interaction, serverData, userData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('profilelist_')) {

				await profilelistInteractionCollector(interaction)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('store_')) {

				await storeInteractionCollector(interaction, userData, serverData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('repair_')) {

				await repairInteractionCollector(interaction, userData, serverData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('heal_')) {

				await healInteractionCollector(interaction, userData, serverData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}

			if (interaction.customId.startsWith('travel_')) {

				await travelInteractionCollector(interaction, userData, serverData)
					.catch(async (error) => { await sendErrorMessage(interaction, error); });
				return;
			}
			return;
		}
	},
};

setInterval(async function() {

	const userArray = await userModel.find();
	for (const user of userArray) {

		for (const [guildId, quidId] of Object.entries(user.currentQuid)) {

			const quid = user.quids[quidId];
			const activeProfile = quid?.profiles[guildId];
			if (!quid || !activeProfile) { continue; }
			const tenMinutesInMs = 600_000;

			const lastInteraction = lastInteractionMap.get(user.uuid + guildId);
			if (!lastInteraction) { continue; }

			const serverData = await serverModel.findOne(s => s.serverId === lastInteraction.guildId).catch(() => { return null; });
			if (!serverData) { continue; }

			const lastInteractionIsTenMinutesAgo = lastInteraction.createdTimestamp < Date.now() - tenMinutesInMs;
			const hasLessThanMaxEnergy = activeProfile.energy < activeProfile.maxEnergy;
			const isConscious = activeProfile.energy > 0 || activeProfile.health > 0 || activeProfile.hunger > 0 || activeProfile.thirst > 0;
			const hasNoCooldown = cooldownMap.get(user.uuid + guildId) === false;
			if (lastInteractionIsTenMinutesAgo && !activeProfile.isResting && hasLessThanMaxEnergy && isConscious && hasNoCooldown) {

				await startResting(lastInteraction, user, quid, activeProfile, serverData)
					.catch(async (error) => { await sendErrorMessage(lastInteraction, error); });
			}
		}
	}

	for (let [guildId, array] of serverActiveUsersMap.entries()) {

		for (const userId of array) {

			const userData = await userModel.findOne(u => u.userId.includes(userId)).catch(() => { return null; });
			const lastInteraction = userData ? lastInteractionMap.get(userData.uuid + guildId) : undefined;
			/* If there is no last interaction or if the last interaction was created more than 5 minutes ago, remove the user from the array */
			if (!userData || !lastInteraction || lastInteraction.createdTimestamp <= Date.now() - 300_000) { array = array.filter(v => v !== userId); }
		}
		serverActiveUsersMap.set(guildId, array);
	}
}, 60_000);