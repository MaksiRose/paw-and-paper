import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, StringSelectMenuBuilder, SlashCommandBuilder, Snowflake, StringSelectMenuInteraction } from 'discord.js';
import { userModel } from '../../oldModels/userModel';
import { CurrentRegionType, RankType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { getMapData, respond, valueInObject } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { sendDrinkMessage } from '../gameplay_maintenance/drink';
import { getHealResponse } from '../gameplay_maintenance/heal';
import { showInventoryMessage } from '../gameplay_maintenance/inventory';
import { executeResting } from '../gameplay_maintenance/rest';
import { sendStoreMessage } from '../gameplay_maintenance/store';
import { remindOfAttack } from './attack';
import { executePlaying } from './play';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('travel-regions')
		.setDescription('Go to a specific region in your pack, and see who else is there.')
		.addStringOption(option =>
			option.setName('region')
				.setDescription('The region you want to travel to.')
				.setChoices(
					{ name: CurrentRegionType.SleepingDens, value: CurrentRegionType.SleepingDens },
					{ name: CurrentRegionType.FoodDen, value: CurrentRegionType.FoodDen },
					{ name: CurrentRegionType.MedicineDen, value: CurrentRegionType.MedicineDen },
					{ name: CurrentRegionType.Ruins, value: CurrentRegionType.Ruins },
					{ name: CurrentRegionType.Lake, value: CurrentRegionType.Lake },
					{ name: CurrentRegionType.Prairie, value: CurrentRegionType.Prairie },
				)
				.setRequired(false))

		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 4,
	disablePreviousCommand: true,
	modifiesServerProfile: false, // This is technically true, but it's set to false because it does not necessarily reflect your actual activity
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler in sendQuestMessage
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);
		const chosenRegion = interaction.options.getString('region');

		const id = await sendTravelMessage(interaction, userData, messageContent, restEmbed, chosenRegion);
		saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, id, interaction);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; }

		const messageContent = interaction.message.content;
		const restEmbed = interaction.message.embeds.slice(0, -1).map(c => new EmbedBuilder(c.toJSON()));

		if (interaction.isButton()) {

			if (interaction.customId.includes('rest')) {

				await executeResting(interaction, userData, serverData);
			}
			else if (interaction.customId.includes('inventory')) {

				await showInventoryMessage(interaction, userData, serverData, 1);
			}
			else if (interaction.customId.includes('store')) {

				await sendStoreMessage(interaction, userData, serverData, restEmbed);
			}
			else if (interaction.customId.includes('heal')) {

				await getHealResponse(interaction, userData, serverData, messageContent, restEmbed, 0);
			}
			else if (interaction.customId.includes('drink')) {

				await sendDrinkMessage(interaction, userData, messageContent, restEmbed);
			}
			else if (interaction.customId.includes('play')) {

				await executePlaying(interaction, userData, serverData, { forceEdit: true });
			}
		}
		else if (interaction.isStringSelectMenu()) {

			await sendTravelMessage(interaction, userData, '', restEmbed, interaction.values[0] ?? null);
		}

	},
};

async function sendTravelMessage(
	interaction: ChatInputCommandInteraction<'cached'> | StringSelectMenuInteraction<'cached'>,
	userData: UserData<never, never>,
	messageContent: string,
	restEmbed: EmbedBuilder[],
	chosenRegion: string | null,
): Promise<Snowflake> {

	const embed = new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
			iconURL: quid.avatarURL,
		});
	const travelComponent = new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`travel-regions_options_@${userData.id}`)
			.setPlaceholder('Select a region to travel to')
			.setOptions([
				{ label: CurrentRegionType.SleepingDens, value: CurrentRegionType.SleepingDens, emoji: '💤' },
				{ label: CurrentRegionType.FoodDen, value: CurrentRegionType.FoodDen, emoji: '🍖' },
				{ label: CurrentRegionType.MedicineDen, value: CurrentRegionType.MedicineDen, emoji: '🌿' },
				{ label: CurrentRegionType.Ruins, value: CurrentRegionType.Ruins, emoji: '🏛️' },
				{ label: CurrentRegionType.Lake, value: CurrentRegionType.Lake, emoji: '🌊' },
				{ label: CurrentRegionType.Prairie, value: CurrentRegionType.Prairie, emoji: '🌼' },
			]),
		);

	if (chosenRegion && valueInObject(CurrentRegionType, chosenRegion)) {

		await userData.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, quid.id).profiles, interaction.guildId);
				p.currentRegion = chosenRegion;
			},
		);
	}

	if (chosenRegion === CurrentRegionType.SleepingDens) {

		embed.setDescription(`*${quid.name} slowly trots to the sleeping dens, tired from all the hard work ${pronoun(quid, 0)} did. For a moment, the ${getDisplayspecies(quid)} thinks about if ${pronounAndPlural(quid, 0, 'want')} to rest or just a break.*`);

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`travel-regions_rest_@${userData.id}`)
					.setLabel('Rest')
					.setStyle(ButtonStyle.Primary))],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.FoodDen) {

		embed.setDescription(`*${quid.name} runs to the food den. Maybe ${pronoun(quid, 0)} will eat something, or put ${pronoun(quid, 2)} food onto the pile.*`);
		const allFoodDenUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.currentRegion === CurrentRegionType.FoodDen;
				}).length > 0;
			},
		)).map(user => `<@${Object.keys(user.userIds)[0]}>`).slice(0, 45);
		if (allFoodDenUsersList.length > 0) { embed.addFields({ name: 'Packmates at the food den:', value: allFoodDenUsersList.join('\n') }); }

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(`travel-regions_inventory_@${userData.id}`)
						.setLabel('View inventory')
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId(`travel-regions_store_@${userData.id}`)
						.setLabel('Store items away')
						.setStyle(ButtonStyle.Primary),
				])],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.MedicineDen) {

		embed.setDescription(`*${quid.name} rushes over to the medicine den. Nearby are a mix of packmates, some with illnesses and injuries, others trying to heal them.*`);
		const allMedicineDenUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.currentRegion === CurrentRegionType.MedicineDen;
				}).length > 0;
			},
		)).map(user => `<@${Object.keys(user.userIds)[0]}>`).slice(0, 45);
		if (allMedicineDenUsersList.length > 0) { embed.addFields({ name: 'Packmates at the medicine den:', value: allMedicineDenUsersList.join('\n') }); }
		const allHealerUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.rank !== RankType.Youngling;
				}).length > 0;
			},
		)).map(user => `<@${Object.keys(user.userIds)[0]}>`).slice(0, 45);
		if (allHealerUsersList.length > 0) { embed.addFields({ name: 'Packmates that can heal:', value: allHealerUsersList.join('\n') }); }

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [
				travelComponent,
				...(quidToServer.rank === RankType.Youngling ? [] : [new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(`travel-regions_heal_@${userData.id}`)
						.setLabel('Heal')
						.setStyle(ButtonStyle.Primary))]),
			],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.Ruins) {

		embed.setDescription(`*${quid.name} walks up to the ruins, carefully stepping over broken bricks. Hopefully, ${pronoun(quid, 0)} will find someone to talk with.*`);
		const allRuinsUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.currentRegion === CurrentRegionType.Ruins;
				}).length > 0;
			},
		)).map(user => `<@${Object.keys(user.userIds)[0]}>`).slice(0, 45);
		if (allRuinsUsersList.length > 0) { embed.addFields({ name: 'Packmates at the ruins:', value: allRuinsUsersList.join('\n') }); }

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.Lake) {

		embed.setDescription(`*${quid.name} looks at ${pronoun(quid, 2)} reflection as ${pronounAndPlural(quid, 0, 'passes', 'pass')} the lake. Suddenly the ${getDisplayspecies(quid)} remembers how long ${pronounAndPlural(quid, 0, 'has', 'have')}n't drunk anything.*`);

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`travel-regions_drink_@${userData.id}`)
					.setLabel('Drink')
					.setStyle(ButtonStyle.Primary))],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.Prairie) {

		embed.setDescription(`*${quid.name} approaches the prairie, watching younger packmates testing their strength in playful fights. Maybe the ${getDisplayspecies(quid)} could play with them!*`);
		const allPrairieUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.currentRegion === CurrentRegionType.Prairie;
				}).length > 0;
			},
		)).map(user => `<@${Object.keys(user.userIds)[0]}>`).slice(0, 45);
		if (allPrairieUsersList.length > 0) { embed.addFields({ name: 'Packmates at the prairie:', value: allPrairieUsersList.join('\n') }); }

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`travel-regions_play_@${userData.id}`)
					.setLabel('Play')
					.setStyle(ButtonStyle.Primary))],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else {

		embed.setDescription(`You are currently at the ${quidToServer.currentRegion}! Here are the regions you can go to:`);
		embed.setFields([
			{ name: '💤 sleeping dens', value: 'A place to sleep and relax. Go here if you need to refill your energy!' },
			{ name: '🍖 food den', value: 'Inspect all the food the pack has gathered, eat some or add to it from your inventory!' },
			{ name: '🌿 medicine den', value: 'Go here if you need to be healed. Someone will come and help you.' },
			{ name: '🏛️ ruins', value: 'These old stones are a little creepy at night, but at day packmates frequently gather here to talk and meet up.' },
			{ name: '🌊 lake', value: 'Not only do some aquatic packmates live here, but it is also the primary source of fresh water, in case someone is thirsty.' },
			{ name: '🌼 prairie', value: 'This is where the Younglings go to play! Everyone else can also come here and play with them.' },
		]);

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined)).id;
	}
}