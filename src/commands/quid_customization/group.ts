import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionReplyOptions, ModalBuilder, RestOrArray, SelectMenuComponentOptionData, SlashCommandBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { userModel } from '../../oldModels/userModel';
import { UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasName } from '../../utils/checkUserState';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import { capitalize, getMapData, respond } from '../../utils/helperFunctions';
import { createId } from './name';

type CustomIdArgs = ['groupselect', `${number}`] | ['create'] | ['rename' | 'delete' | 'tag' | 'confirm' | 'cancel' | 'join' | 'leave' | 'maingroup', string]
type SelectOptionArgs = ['nextpage', string] | ['switchto', string]

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('group')
		.setDescription('Create, delete, edit, join and leave groups.')
		.toJSON(),
	category: 'page1',
	position: 10,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		if (!hasName(userData, interaction)) { return; } // This is always a reply

		// This is always a reply
		await respond(interaction, getGroupMessage(userData, 0));
	},
	async sendMessageComponentResponse(interaction, userData) {

		if (!hasName(userData)) { return; }

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (customId === null) { return; }

		if (interaction.isButton() && (customId.args[0] === 'create' || customId.args[0] === 'rename')) {

			await interaction
				.showModal(new ModalBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, customId.args))
					.setTitle(`${capitalize(customId.args[0])} a group`)
					.addComponents(
						new ActionRowBuilder<TextInputBuilder>()
							.setComponents([new TextInputBuilder()
								.setCustomId('name')
								.setLabel('Name')
								.setStyle(TextInputStyle.Short)
								.setMaxLength(48)
								.setRequired(true)
								.setValue(userData.groups.get(customId.args[1] ?? '')?.name ?? ''),
							]),
					),
				);
			return;
		}

		if (interaction.isButton() && customId.args[0] === 'delete') {

			const group = userData.groups.get(customId.args[1]);
			if (group === undefined) { throw TypeError('group is undefined'); }
			await respond(interaction, {
				content: `Are you sure you want to delete group \`${group.name}\`? This is permanent!`,
				embeds: [],
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['confirm', customId.args[1]]))
						.setLabel('Confirm')
						.setStyle(ButtonStyle.Danger),
					new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['cancel', customId.args[1]]))
						.setLabel('Cancel')
						.setStyle(ButtonStyle.Secondary))],
			}, 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton() && (customId.args[0] === 'confirm' || customId.args[0] === 'cancel')) {

			const group_id = customId.args[1];
			if (customId.args[0] === 'confirm') {
				userData.update(
					u => {
						delete u.groups[group_id];
					},
				);
			}

			// This is always an update to the message with the select menu
			await respond(interaction, getGroupMessage(userData, 0, customId.args[0] === 'confirm' ? undefined : group_id), 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton() && customId.args[0] === 'tag') {

			const group = userData.groups.get(customId.args[1]);
			if (group === undefined) { throw TypeError('group is undefined'); }
			await interaction
				.showModal(new ModalBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, customId.args))
					.setTitle('Set group tag')
					.addComponents(
						new ActionRowBuilder<TextInputBuilder>()
							.setComponents([new TextInputBuilder()
								.setCustomId('tag')
								.setLabel('Tag')
								.setStyle(TextInputStyle.Short)
								.setMinLength(0)
								.setMaxLength(16)
								.setRequired(false)
								.setValue(interaction.inGuild() ? (group.tag.servers[interaction.guildId] ?? '') : group.tag.global),
							]),
					),
				);
			return;
		}

		if (interaction.isButton() && customId.args[0] === 'join') {

			const hasMainGroup = userData.quid.mainGroup !== null;
			const groupId = customId.args[1];
			userData.update(
				u => {
					if (!hasMainGroup) { getMapData(u.quids, userData.quid._id).mainGroup = groupId; }
					u.group_quid.push({ groupId: groupId, quidId: userData.quid._id });
				},
			);
			const group = userData.groups.get(groupId);
			if (group === undefined) { throw new TypeError('group is undefined'); }

			// This is always an update to the message with the select menu
			await respond(interaction, getGroupMessage(userData, 0, groupId), 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`${userData.quid.name} joined the group ${group.name}!`)
					.setDescription(!hasMainGroup ? 'This is now this quids main group. The main group determines which groups tag is going to displayed. If your quid has an individual tag, it will overwrite the group tag. To change the quids main group, just select another group from the command and click "Make this the main group".' : null)],
				ephemeral: true,
			});
			return;
		}

		if (interaction.isButton() && customId.args[0] === 'leave') {

			const groupId = customId.args[1];
			const isMainGroup = userData.quid.mainGroup === customId.args[1];
			userData.update(
				u => {
					u.group_quid = u.group_quid.filter(g => (g.groupId === groupId && g.quidId === userData.quid._id) === false);
					if (isMainGroup) { getMapData(u.quids, userData.quid._id).mainGroup = u.group_quid.find(g => g.quidId === userData.quid._id)?.groupId ?? null; }
				},
			);
			const group = userData.groups.get(groupId);
			if (group === undefined) { throw new TypeError('group is undefined'); }

			// This is always an update to the message with the select menu
			await respond(interaction, getGroupMessage(userData, 0, groupId), 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`${userData.quid.name} left the group ${group.name}!`)
					.setDescription((isMainGroup && userData.quid.mainGroup !== null) ? `This was this quids main group, so the main group has been changed to ${userData.groups.get(userData.quid.mainGroup)?.name}. The main group determines which groups tag is going to displayed. If your quid has an individual tag, it will overwrite the group tag. To change the quids main group, just select another group from the command and click "Make this the main group".` : null)],
				ephemeral: true,
			});
			return;
		}

		if (interaction.isButton() && customId.args[0] === 'maingroup') {

			const groupId = customId.args[1];
			userData.update(
				u => {
					getMapData(u.quids, userData.quid._id).mainGroup = groupId;
				},
			);
			const group = userData.groups.get(groupId);
			if (group === undefined) { throw new TypeError('group is undefined'); }

			// This is always an update to the message with the select menu
			await respond(interaction, getGroupMessage(userData, 0, groupId), 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`${group.name} is now the main group for ${userData.quid.name}!`)
					.setDescription('The main group determines which groups tag is going to displayed. If your quid has an individual tag, it will overwrite the group tag.')],
				ephemeral: true,
			});
			return;
		}

		if (interaction.isStringSelectMenu()) {

			const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
			if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

			let groupsPage = Number(customId.args[1]);
			const groupId = selectOptionId[1];

			/* Getting the quidsPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
			if (selectOptionId[0] === 'nextpage') {

				groupsPage += 1;
				if (groupsPage >= Math.ceil((userData.groups.size + 1) / 24)) { groupsPage = 0; }
			}

			// This is always an update to the message with the select menu
			await respond(interaction, getGroupMessage(userData, groupsPage, groupId), 'update', interaction.message.id);
			return;
		}
	},
	async sendModalResponse(interaction, userData, serverData) {

		if (!hasName(userData) || !interaction.isFromMessage()) { return; }

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (customId === null) { return; }

		if (customId.args[0] === 'create' || customId.args[0] === 'rename') {

			const name = interaction.fields.getTextInputValue('name');
			const group_id = customId.args[1] ?? await createId();

			userData.update(
				u => {

					const group = u.groups[group_id];
					if (group === undefined) {

						u.groups[group_id] = {
							_id: group_id,
							name: name,
							tag: {
								global: '',
								servers: {},
							},
						};
					}
					else { group.name = name; }
				},
			);

			// This is always an update to the message with the select menu
			await respond(interaction, getGroupMessage(userData, 0, group_id), 'update', interaction.message.id);
			return;
		}

		if (customId.args[0] === 'tag') {

			const tag = interaction.fields.getTextInputValue('tag');
			const group_id = customId.args[1];

			userData.update(
				u => {

					const group = getMapData(u.groups, group_id);
					if (interaction.inGuild()) { group.tag.servers[interaction.guildId] = tag; }
					else { group.tag.global = tag; }
				},
			);
			const group = userData.groups.get(group_id);
			if (group === undefined) { throw new TypeError('group is undefined'); }

			// This is always an update to the message with the select menu
			await respond(interaction, getGroupMessage(userData, 0, group_id), 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`Tag ${tag ? `set to ${tag}` : 'removed'} ${serverData ? `in ${serverData.name}!` : 'globally!'}`)
					.setDescription(serverData ? 'Tip: Tags can be set globally (cross-server) too by executing the /group command in DMs. The global tag will be displayed when no server-specific tag has been chosen.' : 'Tip: Tags can be set server-specific too by executing the command in the server. The server-specific tag will overwrite the global tag for that server.' + ' You can remove the tag again by leaving the text box empty.')],
				ephemeral: true,
			});
			return;
		}
	},
};

/**
 * It gets the main group of the user, and if it exists, it creates an embed with the group's name, tag, and members
 * @param userData - UserData<never, ''>
 * @returns A function that returns an object with a content property and an embeds property.
 */
export function getGroupMessage(
	userData: UserData<never, ''>,
	groupsPage: number,
	currentGroupId?: string,
): InteractionReplyOptions {

	const currentGroup = userData.groups.get(currentGroupId ?? userData.quid.mainGroup ?? '');
	const _userData = (() => {
		try { return userModel.findOne(u => u._id === userData._id); }
		catch { return null; }
	})();


	let groupOptions: RestOrArray<SelectMenuComponentOptionData> = userData.groups.map(group => ({
		label: group.name,
		value: constructSelectOptions<SelectOptionArgs>(['switchto', group._id]),
		default: currentGroup?._id === group._id ? true : false,
	}));

	groupOptions.push({
		label: 'Empty Slot',
		value: constructSelectOptions<SelectOptionArgs>(['switchto', '']),
		default: currentGroup === undefined ? true : false,
	});

	if (groupOptions.length > 25) {

		groupOptions = groupOptions.splice(groupsPage * 24, 24);
		groupOptions.push({
			label: 'Show more groups',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', currentGroup?._id ?? '']),
			description: `You are currently on page ${groupsPage + 1}`,
			emoji: '📋',
		});
	}

	const quidInGroup = currentGroup === undefined ? false : userData.group_quid.find(g => g.groupId === currentGroup._id && g.quidId === userData.quid._id) !== undefined;

	return {
		content: currentGroup === undefined ? 'You are on an Empty Slot. Select a group to view below.' : '',
		embeds: currentGroup === undefined ? [] : [new EmbedBuilder()
			.setColor(userData.quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			})
			.setTitle(currentGroup.name)
			.setFields([
				{ name: '**🏷️ Tag**', value: currentGroup.tag.servers[userData.quid.profile?.serverId ?? ''] || currentGroup.tag.global || '/' },
				{
					name: '**☂️ Members**',
					value: userData.group_quid
						.filter(g => g.groupId === currentGroup._id)
						.map(g => {

							const quid = _userData?.quids[g.quidId];
							return quid === undefined ? '' : `${quid.name}${(quid.proxy.endsWith !== '' || quid.proxy.startsWith !== '') ? ` (\`${quid.proxy.startsWith}text${quid.proxy.endsWith}\`)` : ''}`;
						})
						.filter(g => g !== '').join('\n') || 'No members',
				},
			])
			.setFooter({ text: `Group ID: ${currentGroup._id}` })],
		components: [
			new ActionRowBuilder<StringSelectMenuBuilder>()
				.setComponents(new StringSelectMenuBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['groupselect', `${groupsPage}`]))
					.setPlaceholder('Select a group to view/edit')
					.setOptions(groupOptions)),
			new ActionRowBuilder<ButtonBuilder>()
				.setComponents(currentGroup === undefined ?
					[new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['create']))
						.setLabel('Create new group')
						.setStyle(ButtonStyle.Success)]
					: [new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['rename', currentGroup._id]))
						.setLabel('Rename group')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['delete', currentGroup._id]))
						.setLabel('Delete group')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['tag', currentGroup._id]))
						.setLabel('Set group tag')
						.setStyle(ButtonStyle.Secondary)]),
			...currentGroup === undefined ? [] : [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, [!quidInGroup ? 'join' : 'leave', currentGroup._id]))
					.setLabel(`${!quidInGroup ? 'Join' : 'Leave'} group`)
					.setStyle(ButtonStyle.Primary),
				...(currentGroup._id === userData.quid.mainGroup || userData.group_quid.find(g => g.quidId === userData.quid._id) === undefined || !quidInGroup) ? [] : [new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['maingroup', currentGroup._id]))
					.setLabel('Make this the main group')
					.setStyle(ButtonStyle.Secondary),
				]])],
		],
	};
}