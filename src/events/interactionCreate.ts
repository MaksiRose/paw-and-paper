import { ButtonInteraction, EmbedBuilder, Interaction, RepliableInteraction, SelectMenuInteraction } from 'discord.js';
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
import userModel, { getUserData } from '../models/userModel';
import { DiscordEvent } from '../typings/main';
import { disableCommandComponent, disableAllComponents } from '../utils/componentDisabling';
import { getMapData, keyInObject, update } from '../utils/helperFunctions';
import { createGuild } from '../utils/updateGuild';
import { respond } from '../utils/helperFunctions';
import { sendErrorMessage } from '../utils/helperFunctions';
import { adventureInteractionCollector } from '../commands/interaction/adventure';
import { playfightInteractionCollector } from '../commands/interaction/playfight';
import { generateId } from 'crystalid';
import { readFileSync, writeFileSync } from 'fs';
import { profilelistInteractionCollector } from '../commands/interaction/profilelist';
import { isResting, startResting } from '../commands/gameplay_maintenance/rest';
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
import { executePlaying, command as playCommand } from '../commands/gameplay_primary/play';
import { executeExploring, command as exploreCommand } from '../commands/gameplay_primary/explore';
import { executeAttacking, command as attackCommand } from '../commands/gameplay_primary/attack';
import { wrongproxyInteractionCollector } from '../contextmenu/wrong-proxy';
import { missingPermissions } from '../utils/permissionHandler';
import { client, handle } from '../index';
import { ErrorStacks } from '../typings/data/general';
import { hasNameAndSpecies } from '../utils/checkUserState';
const { version } = require('../../package.json');
const { error_color } = require('../../config.json');

export const cooldownMap: Map<string, boolean> = new Map();
export const lastInteractionMap: Map<string, RepliableInteraction<'cached'>> = new Map();
export const serverActiveUsersMap: Map<string, string[]> = new Map();

export const event: DiscordEvent = {
	name: 'interactionCreate',
	once: false,
	async execute(interaction: Interaction) {
		try {

			/* This is only null when in DM without CHANNEL partial, or when channel cache is sweeped. Therefore, this is technically unsafe since this value could become null after this check. This scenario is unlikely though. */
			if (!interaction.channel) { await client.channels.fetch(interaction.channelId || ''); }

			const _userData = await userModel.findOne(u => u.userId.includes(interaction.user.id)).catch(() => { return null; });
			const userData = _userData === null ? null : getUserData(_userData, interaction.guildId ?? 'DM', _userData.quids[_userData.currentQuid[interaction.guildId ?? 'DM'] ?? '']);
			let serverData = await serverModel.findOne(s => s.serverId === interaction.guildId).catch(() => { return null; });

			/* It's setting the last interaction timestamp for the user to now. */
			if (userData && interaction.inCachedGuild() && interaction.isRepliable()) {

				lastInteractionMap.set(userData._id + interaction.guildId, interaction);

				const serverActiveUsers = serverActiveUsersMap.get(interaction.guildId);
				if (!serverActiveUsers) { serverActiveUsersMap.set(interaction.guildId, [interaction.user.id]); }
				else if (!serverActiveUsers.includes(interaction.user.id)) { serverActiveUsers.push(interaction.user.id); }
			}

			/* Checking if the serverData is null. If it is null, it will create a guild. */
			if (!serverData && interaction.inCachedGuild()) { serverData = await createGuild(interaction.guild); }

			if (interaction.isRepliable() && interaction.inRawGuild()) {

				await interaction
					.reply({
						content: 'Oops, I am missing the `bot` scope that is normally part of the invite link. Please re-invite the bot!',
					});
				return;
			}

			if (interaction.isAutocomplete()) {

				/**
				 * https://discordjs.guide/interactions/autocomplete.html#responding-to-autocomplete-interactions
				 */

				/* Getting the command from the client and checking if the command is undefined.
				If it is, it will error. */
				const command = handle.slashCommands.get(interaction.commandName);
				if (command === undefined || !keyInObject(command, 'sendAutocomplete')) { return; }

				/* It's sending the autocomplete message. */
				await command.sendAutocomplete?.(interaction, userData, serverData);
				return;
			}

			if (interaction.isChatInputCommand()) {

				/* Getting the command from the client and checking if the command is undefined. If it is, it will error. */
				const command = handle.slashCommands.get(interaction.commandName);
				if (command === undefined || !keyInObject(command, 'sendCommand')) { return await sendErrorMessage(interaction, new Error('Unknown command')); }

				/* If the user is not registered in the cooldown map, it's setting the cooldown to false for the user. */
				if (userData && interaction.guildId && !cooldownMap.has(userData._id + interaction.guildId)) { cooldownMap.set(userData._id + interaction.guildId, false); }

				/* It's disabling all components if userData exists and the command is set to disable a previous command. */
				if (userData && command.disablePreviousCommand) {

					if (await missingPermissions(interaction, [
						'ViewChannel',
					]) === true) { return; }

					await disableCommandComponent[userData._id + (interaction.guildId || 'DM')]?.();
				}

				/* It's disabling all components if userData exists and the command is set to disable a previous command. */
				if (userData && userData.quid && interaction.inGuild() && command.modifiesServerProfile) {

					await userData
						.update(
							(u) => {
								const p = getMapData(getMapData(u.quids, userData!.quid!._id).profiles, interaction.guildId);
								p.lastActiveTimestamp = Date.now();
							},
						);
				}

				/* This sends the command and error message if an error occurs. */
				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully executed \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				await command.sendCommand(interaction, userData, serverData);

				if (interaction.inGuild()) {

					/* If sapling exists, a gentle reminder has not been sent and the watering time is after the perfect time, send a gentle reminder */
					if (hasNameAndSpecies(userData) && userData.quid.profile.sapling.exists && !userData.quid.profile.sapling.sentGentleReminder && Date.now() > (userData.quid.profile.sapling.nextWaterTimestamp || 0) + 60_000) { // The 60 seconds is so this doesn't trigger when you just found your sapling while exploring

						await userData.update(
							(u) => {
								const p = getMapData(getMapData(u.quids, userData!.quid!._id).profiles, interaction.guildId);
								p.sapling.sentGentleReminder = true;
							},
						);

						await interaction
							.followUp({
								embeds: [new EmbedBuilder()
									.setColor(userData.quid.color)
									.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
									.setDescription(`*Engrossed in ${userData.quid.pronoun(2)} work, ${userData.quid.name} suddenly remembers that ${userData.quid.pronounAndPlural(0, 'has', 'have')} not yet watered ${userData.quid.pronoun(2)} plant today. The ${userData.quid.getDisplayspecies()} should really do it soon!*`)
									.setFooter({ text: 'Type "/water-tree" to water your ginkgo sapling!' })],
							});
					}
				}

				/* This is checking if the user has used the bot since the last update. If they haven't, it will
				send them a message telling them that there is a new update. */
				if (Number(userData?.lastPlayedVersion) < Number(version.split('.').slice(0, -1).join('.'))) {

					await interaction
						.followUp({
							content: `A new update has come out since you last used the bot! You can view the changelog here: <https://github.com/MaksiRose/paw-and-paper/releases/tag/v${version.split('.').slice(0, -1).join('.')}.0>`,
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
				const command = handle.contextMenuCommands.get(interaction.commandName);
				if (command === undefined || !keyInObject(command, 'sendCommand')) { return await sendErrorMessage(interaction, new Error('Unknown command')); }

				/* This sends the command and error message if an error occurs. */
				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully executed \x1b[31m${interaction.commandName} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				await command.sendCommand(interaction);
				return;
			}

			if (interaction.isModalSubmit()) {

				console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully submitted the modal \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

				if (interaction.customId.startsWith('edit')) {

					await sendEditMessageModalResponse(interaction);
					return;
				}

				if (interaction.customId.startsWith('species')) {

					await sendEditDisplayedSpeciesModalResponse(interaction);
					return;
				}

				if (interaction.customId.startsWith('pronouns') && interaction.isFromMessage()) {

					await sendEditPronounsModalResponse(interaction);
					return;
				}

				if (interaction.customId.startsWith('proxy')) {

					await sendEditProxyModalResponse(interaction);
					return;
				}

				if (interaction.customId.startsWith('ticket') && interaction.isFromMessage()) {

					await sendRespondToTicketModalResponse(interaction);
					return;
				}

				if (interaction.customId.startsWith('skills') && interaction.isFromMessage()) {

					await sendEditSkillsModalResponse(interaction, serverData, userData);
					return;
				}
				return;
			}

			if (interaction.isMessageComponent()) {

				/* It's checking if the user that created the command is the same as the user that is interacting with the command, or if the user that is interacting is mentioned in the interaction.customId. If neither is true, it will send an error message. */
				const isCommandCreator = interaction.message.interaction !== null && interaction.message.interaction.user.id === interaction.user.id;
				const isMentioned = interaction.customId.includes('@' + interaction.user.id) || interaction.customId.includes('@EVERYONE') || (_userData && (interaction.customId.includes(_userData._id) || Object.keys(_userData.quids).some(q => interaction.customId.includes('@' + q))));

				if (interaction.isSelectMenu()) {

					console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully selected \x1b[31m${interaction.values[0]} \x1b[0mfrom the menu \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

					if (interaction.customId.startsWith('help_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, helpInteractionCollector, [interaction]);
						return;
					}

					if (interaction.customId.startsWith('shop_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, shopInteractionCollector, [interaction, userData, serverData]);
						return;
					}

					if (interaction.customId.startsWith('inventory_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, inventoryInteractionCollector, [interaction, userData, serverData]);
						return;
					}

					if (interaction.customId.startsWith('vote_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, voteInteractionCollector, [interaction, userData]);
						return;
					}

					if (interaction.customId.startsWith('wrongproxy_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, wrongproxyInteractionCollector, [interaction, _userData]);
						return;
					}
				}

				if (interaction.isButton()) {

					console.log(`\x1b[32m${interaction.user.tag} (${interaction.user.id})\x1b[0m successfully clicked the button \x1b[31m${interaction.customId} \x1b[0min \x1b[32m${interaction.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

					if (interaction.customId.startsWith('report_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, async () => {

							await update(interaction, {
								components: disableAllComponents(interaction.message.components),
							});

							const errorId = interaction.customId.split('_')[2] || generateId();
							const errorStacks = JSON.parse(readFileSync('./database/errorStacks.json', 'utf-8')) as ErrorStacks;
							const description = errorStacks[errorId] ? `\`\`\`\n${errorStacks[errorId]!.substring(0, 4090)}\n\`\`\`` : interaction.message.embeds[0]?.description;

							if (!description) {

								await respond(interaction, {
									embeds: [new EmbedBuilder()
										.setColor(error_color)
										.setDescription('There was an error trying to report the error... Ironic! Maybe you can try opening a ticket via `/ticket` instead?')],
									ephemeral: true,
								}, false);
								return;
							}

							await createNewTicket(interaction, `Error ${errorId}`, description, 'bug', null, errorId);
							delete errorStacks[errorId];
							writeFileSync('./database/errorStacks.json', JSON.stringify(errorStacks, null, '\t'));

						}, []);
						return;
					}

					if (interaction.customId.startsWith('ticket_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, ticketInteractionCollector, [interaction]);
						return;
					}

					if (interaction.customId.startsWith('hug_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, hugInteractionCollector, [interaction, userData]);
						return;
					}

					if (interaction.customId.startsWith('friendships_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, friendshipsInteractionCollector, [interaction, userData]);
						return;
					}

					if (interaction.customId.startsWith('adventure_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, adventureInteractionCollector, [interaction, serverData]);
						return;
					}

					if (interaction.customId.startsWith('playfight_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, playfightInteractionCollector, [interaction, serverData]);
						return;
					}

					if (interaction.customId.startsWith('stats_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, statsInteractionCollector, [interaction, userData, serverData]);
						return;
					}

					if (interaction.customId.startsWith('settings_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, settingsInteractionCollector, [interaction, userData, _userData]);
						return;
					}

					if (interaction.customId.startsWith('rank_')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, rankupInteractionCollector, [interaction, userData, serverData]);
						return;
					}

					if (interaction.customId.startsWith('scavenge_new')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, async () => {

							/* It's disabling all components if userData exists and the command is set to disable a previous command. */
							if (userData && scavengeCommand.disablePreviousCommand) { await disableCommandComponent[userData._id + (interaction.guildId || 'DM')]?.(); }

							await executeScavenging(interaction, userData, serverData);
						}, []);
						return;
					}

					if (interaction.customId.startsWith('play_new')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, async () => {

							/* It's disabling all components if userData exists and the command is set to disable a previous command. */
							if (userData && playCommand.disablePreviousCommand) { await disableCommandComponent[userData._id + (interaction.guildId || 'DM')]?.(); }

							await executePlaying(interaction, userData, serverData);
						}, []);
						return;
					}

					if (interaction.customId.startsWith('explore_new')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, async () => {

							/* It's disabling all components if userData exists and the command is set to disable a previous command. */
							if (userData && exploreCommand.disablePreviousCommand) { await disableCommandComponent[userData._id + (interaction.guildId || 'DM')]?.(); }

							await executeExploring(interaction, userData, serverData);
						}, []);
						return;
					}

					if (interaction.customId.startsWith('attack_new')) {

						await interactionResponseGuard(interaction, isCommandCreator, isMentioned, async () => {

							/* It's disabling all components if userData exists and the command is set to disable a previous command. */
							if (userData && attackCommand.disablePreviousCommand) { await disableCommandComponent[userData._id + (interaction.guildId || 'DM')]?.(); }

							await executeAttacking(interaction, userData, serverData);
						}, []);
						return;
					}
				}

				if (interaction.customId.startsWith('profile_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, profileInteractionCollector, [interaction]);
					return;
				}

				if (interaction.customId.startsWith('species_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, speciesInteractionCollector, [interaction ]);
					return;
				}

				if (interaction.customId.startsWith('pronouns_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, pronounsInteractionCollector, [interaction]);
					return;
				}

				if (interaction.customId.startsWith('proxy_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, proxyInteractionCollector, [interaction, serverData]);
					return;
				}

				if (interaction.customId.startsWith('delete_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, deleteInteractionCollector, [interaction, userData]);
					return;
				}

				if (interaction.customId.startsWith('serversettings_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, serversettingsInteractionCollector, [interaction, serverData]);
					return;
				}

				if (interaction.customId.startsWith('skills_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, skillsInteractionCollector, [interaction, serverData, userData]);
					return;
				}

				if (interaction.customId.startsWith('profilelist_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, profilelistInteractionCollector, [interaction]);
					return;
				}

				if (interaction.customId.startsWith('store_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, storeInteractionCollector, [interaction, userData, serverData]);
					return;
				}

				if (interaction.customId.startsWith('repair_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, repairInteractionCollector, [interaction, userData, serverData]);
					return;
				}

				if (interaction.customId.startsWith('heal_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, healInteractionCollector, [interaction, userData, serverData]);
					return;
				}

				if (interaction.customId.startsWith('travel_')) {

					await interactionResponseGuard(interaction, isCommandCreator, isMentioned, travelInteractionCollector, [interaction, userData, serverData]);
					return;
				}
				return;
			}
		}
		catch (error) {

			if (interaction.isRepliable()) {

				await sendErrorMessage(interaction, error)
					.catch(e => { console.error(e); });
			}
			else { console.error(error); }
		}
	},
};

setInterval(async function() {

	const userArray = await userModel.find();
	for (const user of userArray) {

		for (const [guildId, quidId] of Object.entries(user.currentQuid)) {

			const userData = getUserData(user, guildId, getMapData(user.quids, quidId));
			if (!hasNameAndSpecies(userData)) { continue; }
			const tenMinutesInMs = 600_000;

			const lastInteraction = lastInteractionMap.get(user._id + guildId);
			if (!lastInteraction) { continue; }

			const serverData = await serverModel.findOne(s => s.serverId === lastInteraction.guildId).catch(() => { return null; });
			if (!serverData) { continue; }

			const lastInteractionIsTenMinutesAgo = lastInteraction.createdTimestamp < Date.now() - tenMinutesInMs;
			const hasLessThanMaxEnergy = userData.quid.profile.energy < userData.quid.profile.maxEnergy;
			const isConscious = userData.quid.profile.energy > 0 || userData.quid.profile.health > 0 || userData.quid.profile.hunger > 0 || userData.quid.profile.thirst > 0;
			const hasNoCooldown = cooldownMap.get(userData._id + guildId) !== true;
			if (lastInteractionIsTenMinutesAgo && userData.quid.profile.isResting === false && isResting(userData) === false && hasLessThanMaxEnergy && isConscious && hasNoCooldown) {

				await startResting(lastInteraction, userData, serverData)
					.catch(async (error) => {
						await sendErrorMessage(lastInteraction, error)
							.catch(e => { console.error(e); });
					});
			}
		}
	}

	for (let [guildId, array] of serverActiveUsersMap.entries()) {

		for (const userId of array) {

			const userData = await userModel.findOne(u => u.userId.includes(userId)).catch(() => { return null; });
			const lastInteraction = userData ? lastInteractionMap.get(userData._id + guildId) : undefined;
			/* If there is no last interaction or if the last interaction was created more than 5 minutes ago, remove the user from the array */
			if (!userData || !lastInteraction || lastInteraction.createdTimestamp <= Date.now() - 300_000) { array = array.filter(v => v !== userId); }
		}
		serverActiveUsersMap.set(guildId, array);
	}
}, 60_000);

async function interactionResponseGuard<T extends unknown[], U>(
	interaction: ButtonInteraction | SelectMenuInteraction,
	isCommandCreator: boolean,
	isMentioned: boolean | null,
	callback: (...args: T) => U,
	callbackArgs: T,
) {

	if (!isCommandCreator && !isMentioned) {

		await respond(interaction, {
			content: 'Sorry, I only listen to the person that created the command 😣',
			ephemeral: true,
		}, false);
		return;
	}
	return await callback(...callbackArgs);
}
