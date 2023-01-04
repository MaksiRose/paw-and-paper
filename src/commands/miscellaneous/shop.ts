import { ActionRowBuilder, ChatInputCommandInteraction, EmbedBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, AnySelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { checkRoleCatchBlock } from '../../utils/checkRoleRequirements';
import { hasName, hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { UserData, WayOfEarningType } from '../../typings/data/user';
import { ServerSchema } from '../../typings/data/server';
import { constructCustomId, constructSelectOptions, deconstructSelectOptions } from '../../utils/customId';
const { error_color, default_color } = require('../../../config.json');

type CustomIdArgs = []
type SelectOptionArgs = ['nextpage', `${number}`, `${number}`] | [string]

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Buy roles with experience points.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page5',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData, serverData) => {

		if (!isInGuild(interaction)) { return; } // This is always a reply
		if (!hasName(userData, interaction)) { return; } // This is always a reply
		if (serverData === null) { throw new Error('serverData is null'); }

		const shopInfo = getShopInfo(serverData);
		const shopKindPage = shopInfo.xpRolesPages > 0 ? 0 : shopInfo.rankRolesPages > 0 ? 1 : shopInfo.levelRolesPages > 0 ? 2 : null;
		const nestedPage = 0;

		if (serverData.shop.length === 0 || shopKindPage === null) {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('There are currently no roles in the shop!')],
				ephemeral: true,
			});
			return;
		}

		await getShopResponse(interaction, serverData, userData, shopKindPage, nestedPage); // This is always a reply
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		if (!interaction.isStringSelectMenu()) { return; }
		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
		if (userData === null) { throw new Error('userData is null'); }
		if (serverData === null) { throw new Error('serverData is null'); }

		const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
		if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

		if (selectOptionId[0] === 'nextpage') {

			if (!hasName(userData, interaction)) { return; } // This is always a reply
			const shopKindPage = Number(selectOptionId[1]);
			const nestedPage = Number(selectOptionId[2]);
			const { newShopKindPage, newNestedPage } = getShopInfo(serverData).nextPage(shopKindPage, nestedPage);

			await getShopResponse(interaction, serverData, userData, newShopKindPage, newNestedPage); // This is always an update to the message with the select menu
			return;
		}
		else {

			if (await missingPermissions(interaction, [
				'ManageRoles', // Needed to give out roles configured in this shop
			]) === true) { return; }
			const roleId = selectOptionId[0];
			const buyItem = serverData.shop.find((shopRole) => shopRole.roleId === roleId);
			if (buyItem === undefined) { throw new Error('roleId is undefined or could not be found in server shop'); }
			if (!hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

			if (userData.quid.profile.roles.some(role => role.roleId === buyItem.roleId && role.wayOfEarning === 'experience')) {

				try {

					const userRole = userData.quid.profile.roles.find(role => role.roleId === buyItem.roleId && role.wayOfEarning === 'experience');
					if (userRole === undefined) { throw new Error('userRole is undefined'); }

					userData.update(
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
							p.experience += userRole.requirement as number;
							p.roles = p.roles.filter(r => r.roleId !== userRole.roleId);
						},
					);

					if (interaction.member.roles.cache.has(buyItem.roleId)) { await interaction.member.roles.remove(buyItem.roleId); }

					const levelUpEmbed = await checkLevelUp(interaction, userData, serverData);

					// This is always a reply
					await respond(interaction, {
						embeds: [
							new EmbedBuilder()
								.setColor(default_color)
								.setAuthor({ name: serverData.name, iconURL: interaction.guild.iconURL() || undefined })
								.setDescription(`You refunded the <@&${buyItem.roleId}> role!`),
							...levelUpEmbed,
						],
					});
				}
				catch (error) {

					await checkRoleCatchBlock(error, interaction, interaction.member);
				}
			}
			else if ((userData.quid.profile.levels * (userData.quid.profile.levels - 1) / 2) * 50 + userData.quid.profile.experience >= buyItem.requirement) {

				try {

					let cost = buyItem.requirement as number;

					while (cost > 0) {

						if (cost <= userData.quid.profile.experience) {

							userData.quid.profile.experience -= cost;
							cost -= cost;
						}
						else {

							userData.quid.profile.levels -= 1;
							userData.quid.profile.experience += userData.quid.profile.levels * 50;
						}
					}
					if (userData.quid.profile.experience < 0 || userData.quid.profile.levels < 1) { throw new Error('Could not calculate item cost correctly'); }

					await userData.update(
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
							p.experience = userData!.quid!.profile.experience;
							p.levels = userData!.quid!.profile.levels;
							p.roles.push({
								roleId: buyItem.roleId,
								wayOfEarning: buyItem.wayOfEarning,
								requirement: buyItem.requirement,
							});
						},
					);

					if (!interaction.member.roles.cache.has(buyItem.roleId)) { await interaction.member.roles.add(buyItem.roleId); }

					// This is always a reply
					await respond(interaction, {
						embeds: [new EmbedBuilder()
							.setColor(default_color)
							.setAuthor({ name: serverData.name, iconURL: interaction.guild.iconURL() || undefined })
							.setDescription(`You bought the <@&${buyItem.roleId}> role for ${buyItem.requirement} experience!`)],
					});


					const roles = userData.quid.profile.roles.filter(role => role.wayOfEarning === WayOfEarningType.Levels && role.requirement > userData.quid.profile.levels);

					for (const role of roles) {

						await userData.update(
							(u) => {
								const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
								p.roles.filter(r => r.roleId !== role.roleId);
							},
						);

						if (interaction.member.roles.cache.has(role.roleId)) {

							await interaction.member.roles.remove(role.roleId);

							// This is always a reply
							await respond(interaction, {
								embeds: [new EmbedBuilder()
									.setColor(default_color)
									.setAuthor({ name: serverData.name, iconURL: interaction.guild.iconURL() || undefined })
									.setDescription(`You lost the <@&${role.roleId}> role because of a lack of levels!`)],
							});
						}
					}
				}
				catch (error) {

					await checkRoleCatchBlock(error, interaction, interaction.member);
				}
			}
			else {

				// This is always a reply
				await respond(interaction, {
					content: `You don't have the experience to buy the <@&${buyItem.roleId}> role!`,
					ephemeral: true,
				});
			}

			return;
		}

	},
};

async function getShopResponse(
	interaction: ChatInputCommandInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	serverData: ServerSchema,
	userData: UserData<never, ''>,
	shopKindPage: number,
	nestedPage: number,
): Promise<void> {

	let descriptionArray: string[] = [];
	let shopMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];
	const shopInfo = getShopInfo(serverData);

	if (shopKindPage === 0) {

		let position = 0;
		for (const item of shopInfo.xpRoles) {

			descriptionArray.push(`**${position + 1}.:** <@&${item.roleId}> for ${item.requirement} ${item.wayOfEarning}`);
			shopMenuOptions.push({
				label: `${position + 1}`,
				value: constructSelectOptions<SelectOptionArgs>([item.roleId]),
			});
			position += 1;
		}
	}
	else if (shopKindPage === 1) {

		for (const item of shopInfo.rankRoles) {

			descriptionArray.push(`<@&${item.roleId}> for ${item.requirement} ${item.wayOfEarning}`);
		}
	}
	else if (shopKindPage === 2) {

		for (const item of shopInfo.levelRoles) {

			descriptionArray.push(`<@&${item.roleId}> for ${item.requirement} ${item.wayOfEarning}`);
		}
	}

	if (descriptionArray.length > 25) {

		descriptionArray = descriptionArray.splice(nestedPage * 24, 25);
	}

	if (shopMenuOptions.length > 25) {

		descriptionArray = descriptionArray.splice(nestedPage * 24, 24);
		shopMenuOptions = shopMenuOptions.splice(nestedPage * 24, 24);
	}

	if (shopInfo.levelRolesPages + shopInfo.rankRolesPages + shopInfo.xpRolesPages > 1) {

		const currentPage = shopInfo.currentPage(shopKindPage, nestedPage);
		shopMenuOptions.push({
			label: 'Show more shop items',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${shopKindPage}`, `${nestedPage}`]),
			description: `You are currently on page ${currentPage + 1}`,
			emoji: '📋',
		});
	}

	await respond(interaction, {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setDescription(descriptionArray.join('\n'))],
		components: [new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents(new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, []))
				.setPlaceholder('Select a shop item')
				.setOptions(shopMenuOptions))],
	}, interaction.isStringSelectMenu() ? 'update' : 'reply', '@original');
}

function getShopInfo(serverData: ServerSchema) {

	const xpRoles = serverData.shop.filter(item => item.wayOfEarning === WayOfEarningType.Experience);
	const rankRoles = serverData.shop.filter(item => item.wayOfEarning === WayOfEarningType.Rank);
	const levelRoles = serverData.shop.filter(item => item.wayOfEarning === WayOfEarningType.Levels);

	const xpRolesPages = Math.ceil(xpRoles.length / 24);
	const rankRolesPages = Math.ceil(rankRoles.length / 24);
	const levelRolesPages = Math.ceil(levelRoles.length / 24);

	function currentPage(
		shopKindPage: number,
		nestedPage: number,
	) {

		let pages = nestedPage;
		if (shopKindPage > 0) { pages += xpRolesPages; }
		if (shopKindPage > 1) { pages += rankRolesPages; }
		return pages;
	}

	function nextPage(
		shopKindPage: number,
		nestedPage: number,
	) {

		nestedPage += 1;
		if (shopKindPage === 0 && nestedPage >= xpRolesPages) {
			nestedPage = 0;
			shopKindPage = nestedPage >= rankRolesPages ? 2 : 1;
		}
		else if (shopKindPage === 1 && nestedPage >= rankRolesPages) {
			nestedPage = 0;
			shopKindPage = nestedPage >= levelRolesPages ? 0 : 2;
		}
		else if (shopKindPage === 2 && nestedPage >= levelRolesPages) {
			nestedPage = 0;
			shopKindPage = nestedPage >= xpRolesPages ? 1 : 0;
		}

		return { newShopKindPage: shopKindPage, newNestedPage: nestedPage };
	}

	return {
		xpRoles,
		rankRoles,
		levelRoles,
		xpRolesPages,
		rankRolesPages,
		levelRolesPages,
		nextPage,
		currentPage,
	};
}