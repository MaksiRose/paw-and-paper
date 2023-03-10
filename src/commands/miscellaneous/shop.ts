import { ActionRowBuilder, ChatInputCommandInteraction, EmbedBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, AnySelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { checkRoleCatchBlock, updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { hasName, hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { WayOfEarningType } from '../../typings/data/user';
import { constructCustomId, constructSelectOptions, deconstructSelectOptions } from '../../utils/customId';
import Quid from '../../models/quid';
import ShopRole from '../../models/shopRole';
import QuidToServerToShopRole from '../../models/quidToServerToShopRole';
import QuidToServer from '../../models/quidToServer';
import { generateId } from 'crystalid';
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
	sendCommand: async (interaction, { user, quid }) => {

		if (!isInGuild(interaction)) { return; } // This is always a reply
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		const shopRoles = await ShopRole.findAll({ where: { serverId: interaction.guildId } });
		const shopInfo = getShopInfo(shopRoles);
		const shopKindPage = shopInfo.xpRolesPages > 0 ? 0 : shopInfo.rankRolesPages > 0 ? 1 : shopInfo.levelRolesPages > 0 ? 2 : null;
		const nestedPage = 0;

		if (shopRoles.length === 0 || shopKindPage === null) {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('There are currently no roles in the shop!')],
				ephemeral: true,
			});
			return;
		}

		await getShopResponse(interaction, quid, shopKindPage, nestedPage, shopInfo); // This is always a reply
	},
	async sendMessageComponentResponse(interaction, { user, quid }) {

		if (!interaction.isStringSelectMenu()) { return; }
		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }

		const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
		if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

		if (selectOptionId[0] === 'nextpage') {

			if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
			if (!user) { throw new TypeError('user is undefined'); }

			const shopKindPage = Number(selectOptionId[1]);
			const nestedPage = Number(selectOptionId[2]);

			const shopRoles = await ShopRole.findAll({ where: { serverId: interaction.guildId } });
			const shopInfo = getShopInfo(shopRoles);
			const { newShopKindPage, newNestedPage } = shopInfo.nextPage(shopKindPage, nestedPage);

			await getShopResponse(interaction, quid, newShopKindPage, newNestedPage, shopInfo); // This is always an update to the message with the select menu
			return;
		}
		else {

			if (await missingPermissions(interaction, [
				'ManageRoles', // Needed to give out roles configured in this shop
			]) === true) { return; }
			if (!hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
			if (!user) { throw new TypeError('user is undefined'); }

			const shopRoles = await ShopRole.findAll({ where: { serverId: interaction.guildId } });
			const roleId = selectOptionId[0];

			const roleToBuy = shopRoles.find((shopRole) => shopRole.id === roleId);
			if (roleToBuy === undefined) { throw new Error('roleId is undefined or could not be found in server shop'); }

			const quidToServer = await QuidToServer.findOne({ where: { serverId: interaction.guildId, quidId: quid.id } });
			if (quidToServer === null) { throw new TypeError('quidServer is null'); }

			const quidToServerShopRoles = await QuidToServerToShopRole.findAll({ where: { quidToServerId: quidToServer.id } });
			const quidToServerRoleToBuy = quidToServerShopRoles.find(qssr => qssr.shopRoleId === roleToBuy.id);
			if (quidToServerRoleToBuy) {
				try {

					await quidToServer.update({
						experience: quidToServer.experience + Number(roleToBuy.requirement),
					});
					await quidToServerRoleToBuy.destroy();

					const members = await updateAndGetMembers(user.id, interaction.guild);
					const levelUpEmbed = await checkLevelUp(interaction, quid, quidToServer, members);

					// This is always a reply
					await respond(interaction, {
						embeds: [
							new EmbedBuilder()
								.setColor(default_color)
								.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
								.setDescription(`You refunded the <@&${roleToBuy.id}> role!`),
							...levelUpEmbed,
						],
					});
				}
				catch (error) {

					await checkRoleCatchBlock(error, interaction, interaction.member);
				}
			}
			else if ((quidToServer.levels * (quidToServer.levels - 1) / 2) * 50 + quidToServer.experience >= Number(roleToBuy.requirement)) {
				try {

					let cost = Number(roleToBuy.requirement);

					while (cost > 0) {

						if (cost <= quidToServer.experience) {

							quidToServer.experience -= cost;
							cost -= cost;
						}
						else {

							quidToServer.levels -= 1;
							quidToServer.experience += quidToServer.levels * 50;
						}
					}
					if (quidToServer.experience < 0 || quidToServer.levels < 1) { throw new Error('Could not calculate item cost correctly'); }

					await quidToServer.update({
						experience: quidToServer.experience,
						levels: quidToServer.levels,
					});
					await QuidToServerToShopRole.create({ id: generateId(), quidToServerId: quidToServer.id, shopRoleId: roleToBuy.id });

					const members = await updateAndGetMembers(user.id, interaction.guild);
					for (const member of members) {
						if (!member.roles.cache.has(roleToBuy.id)) { await member.roles.add(roleToBuy.id); }
					}

					// This is always a reply
					await respond(interaction, {
						embeds: [new EmbedBuilder()
							.setColor(default_color)
							.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
							.setDescription(`You bought the <@&${roleToBuy.id}> role for ${roleToBuy.requirement} experience!`)],
					});

					const roles = (await Promise.all(quidToServerShopRoles.map(qtssr => ShopRole.findByPk(qtssr.shopRoleId)))).filter(function(role): role is ShopRole { return role !== null && role.wayOfEarning === WayOfEarningType.Levels && Number(role.requirement) > quidToServer.levels; });

					for (const role of roles) {

						await QuidToServerToShopRole.destroy({ where: { quidToServerId: quidToServer.id, shopRoleId: role.id } });

						for (const member of members) {
							if (member.roles.cache.has(role.id)) {

								await member.roles.remove(role.id);

								// This is always a reply
								await respond(interaction, {
									embeds: [new EmbedBuilder()
										.setColor(default_color)
										.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
										.setDescription(`You lost the <@&${role.id}> role because of a lack of levels!`)],
								});
							}
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
					content: `You don't have the experience to buy the <@&${roleToBuy.id}> role!`,
					ephemeral: true,
				});
			}
			return;
		}
	},
};

async function getShopResponse(
	interaction: ChatInputCommandInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	quid: Quid,
	shopKindPage: number,
	nestedPage: number,
	shopInfo: ReturnType<typeof getShopInfo>,
): Promise<void> {

	let descriptionArray: string[] = [];
	let shopMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	if (shopKindPage === 0) {

		let position = 0;
		for (const item of shopInfo.xpRoles) {

			descriptionArray.push(`**${position + 1}.:** <@&${item.id}> for ${item.requirement} ${item.wayOfEarning}`);
			shopMenuOptions.push({
				label: `${position + 1}`,
				value: constructSelectOptions<SelectOptionArgs>([item.id]),
			});
			position += 1;
		}
	}
	else if (shopKindPage === 1) {

		for (const item of shopInfo.rankRoles) {

			descriptionArray.push(`<@&${item.id}> for ${item.requirement} ${item.wayOfEarning}`);
		}
	}
	else if (shopKindPage === 2) {

		for (const item of shopInfo.levelRoles) {

			descriptionArray.push(`<@&${item.id}> for ${item.requirement} ${item.wayOfEarning}`);
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
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild?.iconURL() || undefined })
			.setDescription(descriptionArray.join('\n'))],
		components: [new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents(new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid.id, []))
				.setPlaceholder('Select a shop item')
				.setOptions(shopMenuOptions))],
	}, interaction.isStringSelectMenu() ? 'update' : 'reply', interaction.isMessageComponent() ? interaction.message.id : undefined);
}

function getShopInfo(shopRoles: ShopRole[]) {

	const xpRoles = shopRoles.filter(item => item.wayOfEarning === WayOfEarningType.Experience);
	const rankRoles = shopRoles.filter(item => item.wayOfEarning === WayOfEarningType.Rank);
	const levelRoles = shopRoles.filter(item => item.wayOfEarning === WayOfEarningType.Levels);

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