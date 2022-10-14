import { ActionRowBuilder, ChatInputCommandInteraction, EmbedBuilder, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { getArrayElement, respond, update } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { Quid, ServerSchema, SlashCommand, UserSchema, WayOfEarningType } from '../../typedef';
import { checkRoleCatchBlock } from '../../utils/checkRoleRequirements';
import { hasName, isInGuild } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
const { error_color, default_color } = require('../../../config.json');

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
	sendCommand: async (client, interaction, userData, serverData) => {

		if (!isInGuild(interaction)) { return; }
		if (!hasName(interaction, userData)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }

		const shopInfo = getShopInfo(serverData);
		const shopKindPage = shopInfo.xpRolesPages > 0 ? 0 : shopInfo.rankRolesPages > 0 ? 1 : shopInfo.levelRolesPages > 0 ? 2 : null;
		const nestedPage = 0;

		if (serverData.shop.length === 0 || shopKindPage === null) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('There are currently no roles in the shop!')],
				ephemeral: true,
			}, false);
			return;
		}

		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		await getShopResponse(interaction, serverData, quidData, shopKindPage, nestedPage);
	},
};

export async function shopInteractionCollector(
	interaction: SelectMenuInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	if (userData === null) { throw new Error('userData is null'); }
	if (serverData === null) { throw new Error('serverData is null'); }
	const selectOptionId = interaction.values[0];

	if (selectOptionId && selectOptionId.startsWith('shop_nextpage_')) {

		const shopKindPage = Number(getArrayElement(selectOptionId.split('_'), 2));
		const nestedPage = Number(getArrayElement(selectOptionId.split('_'), 3));
		const { newShopKindPage, newNestedPage } = getShopInfo(serverData).nextPage(shopKindPage, nestedPage);

		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		await getShopResponse(interaction, serverData, quidData, newShopKindPage, newNestedPage);
		return;
	}
	else if (selectOptionId && selectOptionId.startsWith('shop_')) {

		const roleId = getArrayElement(selectOptionId.split('_'), 1);
		const buyItem = serverData.shop.find((shopRole) => shopRole.roleId === roleId);
		if (buyItem === undefined) { throw new Error('roleId is undefined or could not be found in server shop'); }

		let quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		let profileData = getMapData(quidData.profiles, interaction.guildId);

		if (profileData.roles.some(role => role.roleId === buyItem.roleId && role.wayOfEarning === 'experience')) {

			try {

				const userRole = profileData.roles.find(role => role.roleId === buyItem.roleId && role.wayOfEarning === 'experience');
				if (userRole === undefined) { throw new Error('userRole is undefined'); }

				userData = await userModel.findOneAndUpdate(
					(u => u._id === userData?._id),
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.experience += userRole.requirement as number;
						p.roles = p.roles.filter(r => r.roleId !== userRole.roleId);
					},
				);
				quidData = getMapData(userData.quids, quidData._id);
				profileData = getMapData(quidData.profiles, profileData.serverId);

				if (interaction.member.roles.cache.has(buyItem.roleId)) { await interaction.member.roles.remove(buyItem.roleId); }

				const levelUpCheck = await checkLevelUp(interaction, userData, quidData, profileData, serverData);
				profileData = levelUpCheck.profileData;

				await respond(interaction, {
					embeds: [
						new EmbedBuilder()
							.setColor(default_color)
							.setAuthor({ name: serverData.name, iconURL: interaction.guild.iconURL() || undefined })
							.setDescription(`You refunded the <@&${buyItem.roleId}> role!`),
						...(levelUpCheck.levelUpEmbed ? [levelUpCheck.levelUpEmbed] : []),
					],
				}, false);
			}
			catch (error) {

				await checkRoleCatchBlock(error, interaction, interaction.member);
			}
		}
		else if ((profileData.levels * (profileData.levels - 1) / 2) * 50 + profileData.experience >= buyItem.requirement) {

			try {

				let cost = buyItem.requirement as number;

				while (cost > 0) {

					if (cost <= profileData.experience) {

						profileData.experience -= cost;
						cost -= cost;
					}
					else {

						profileData.levels -= 1;
						profileData.experience += profileData.levels * 50;
					}
				}
				if (profileData.experience < 0 || profileData.levels < 1) { throw new Error('Could not calculate item cost correctly'); }

				userData = await userModel.findOneAndUpdate(
					(u => u._id === userData?._id),
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.experience = profileData.experience;
						p.levels = profileData.levels;
						p.roles.push({
							roleId: buyItem.roleId,
							wayOfEarning: buyItem.wayOfEarning,
							requirement: buyItem.requirement,
						});
					},
				);
				quidData = getMapData(userData.quids, quidData._id);
				profileData = getMapData(quidData.profiles, profileData.serverId);

				if (!interaction.member.roles.cache.has(buyItem.roleId)) { await interaction.member.roles.add(buyItem.roleId); }

				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(default_color)
						.setAuthor({ name: serverData.name, iconURL: interaction.guild.iconURL() || undefined })
						.setDescription(`You bought the <@&${buyItem.roleId}> role for ${buyItem.requirement} experience!`)],
				}, false);


				const roles = profileData.roles.filter(role => role.wayOfEarning === WayOfEarningType.Levels && role.requirement > profileData.levels);

				for (const role of roles) {

					userData = await userModel.findOneAndUpdate(
						(u => u._id === userData?._id),
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
							p.roles.filter(r => r.roleId !== role.roleId);
						},
					);
					quidData = getMapData(userData.quids, quidData._id);
					profileData = getMapData(quidData.profiles, profileData.serverId);

					if (interaction.member.roles.cache.has(role.roleId)) {

						await interaction.member.roles.remove(role.roleId);

						await respond(interaction, {
							embeds: [new EmbedBuilder()
								.setColor(default_color)
								.setAuthor({ name: serverData.name, iconURL: interaction.guild.iconURL() || undefined })
								.setDescription(`You lost the <@&${role.roleId}> role because of a lack of levels!`)],
						}, false);
					}
				}
			}
			catch (error) {

				await checkRoleCatchBlock(error, interaction, interaction.member);
			}
		}
		else {

			await respond(interaction, {
				content: `You don't have the experience to buy the <@&${buyItem.roleId}> role!`,
				ephemeral: true,
			}, false);
		}

		return;
	}
}

async function getShopResponse(
	interaction: ChatInputCommandInteraction<'cached'> | SelectMenuInteraction<'cached'>,
	serverData: ServerSchema,
	quidData: Quid,
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
			shopMenuOptions.push({ label: `${position + 1}`, value: `shop_${item.roleId}` });
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
			label: 'Show more shop items', value: `shop_nextpage_${shopKindPage}_${nestedPage}`, description: `You are currently on page ${currentPage + 1}
		`, emoji: '📋',
		});
	}

	await (async function(messageObject) { return interaction.isSelectMenu() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: serverData.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setDescription(descriptionArray.join('\n'))],
		components: [new ActionRowBuilder<SelectMenuBuilder>()
			.setComponents(new SelectMenuBuilder()
				.setCustomId(`shop_@${quidData._id}`)
				.setPlaceholder('Select a shop item')
				.setOptions(shopMenuOptions))],
	});
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