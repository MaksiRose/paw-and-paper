import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, Message, MessageComponentInteraction, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import userModel from '../../models/userModel';
import { CurrentRegionType, Profile, Quid, RankType, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { pronoun, pronounAndPlural } from '../../utils/getPronouns';
import { getMapData, getQuidDisplayname, respond, update, valueInObject } from '../../utils/helperFunctions';
import { sendDrinkMessage } from '../gameplay_maintenance/drink';
import { getHealResponse } from '../gameplay_maintenance/heal';
import { showInventoryMessage } from '../gameplay_maintenance/inventory';
import { startResting } from '../gameplay_maintenance/rest';
import { sendStoreMessage } from '../gameplay_maintenance/store';
import { remindOfAttack } from './attack';

const name: SlashCommand['name'] = 'travel-regions';
const description: SlashCommand['description'] = 'Go to a specific region in your pack.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
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
	disablePreviousCommand: true,
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasCompletedAccount(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);

		/* Checks if the profile is resting, on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);
		const chosenRegion = interaction.options.getString('region');

		const botReply = await sendTravelMessage(interaction, userData, quidData, profileData, messageContent, embedArray, chosenRegion);
		createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);
	},
};

export async function travelInteractionCollector(
	interaction: MessageComponentInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	if (serverData === null) { throw new TypeError('serverData is null'); }
	if (userData === null) { throw new TypeError('userData is null'); }

	/* Gets the current active quid and the server profile from the account */
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
	const profileData = getMapData(quidData.profiles, interaction.guildId);

	const messageContent = interaction.message.content || null;
	const embedArray = interaction.message.embeds.slice(0, -1).map(c => new EmbedBuilder(c.toJSON()));

	if (interaction.isButton()) {

		if (interaction.customId.includes('rest')) {

			await startResting(interaction, userData, quidData, profileData, serverData);
		}
		else if (interaction.customId.includes('inventory')) {

			await showInventoryMessage(interaction, userData, profileData, serverData, 1);
		}
		else if (interaction.customId.includes('store')) {

			await sendStoreMessage(interaction, userData, quidData, profileData, serverData, embedArray);
		}
		else if (interaction.customId.includes('heal')) {

			await getHealResponse(interaction, userData, serverData, messageContent, embedArray, 0);
		}
		else if (interaction.customId.includes('drink')) {

			await sendDrinkMessage(interaction, userData, quidData, profileData, messageContent, embedArray);
		}
		else if (interaction.customId.includes('play')) {

			// isnt out yet
		}
	}
	else if (interaction.isSelectMenu()) {

		await sendTravelMessage(interaction, userData, quidData, profileData, undefined, embedArray, interaction.values[0] ?? null);
	}
}

async function sendTravelMessage(
	interaction: ChatInputCommandInteraction<'cached'> | SelectMenuInteraction<'cached'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	messageContent: string | null | undefined,
	embedArray: EmbedBuilder[],
	chosenRegion: string | null,
): Promise<Message> {

	const embed = new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: getQuidDisplayname(quidData, interaction.guildId), iconURL: quidData.avatarURL });
	const travelComponent = new ActionRowBuilder<SelectMenuBuilder>()
		.setComponents(new SelectMenuBuilder()
			.setCustomId('travel_options')
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

		await userModel.findOneAndUpdate(
			u => u.uuid === userData.uuid,
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
				p.currentRegion = chosenRegion;
			},
		);
	}

	if (chosenRegion === CurrentRegionType.SleepingDens) {

		embed.setDescription(`*${quidData.name} slowly trots to the sleeping dens, tired from all the hard work ${pronoun(quidData, 0)} did. For a moment, the ${quidData.displayedSpecies || quidData.species} thinks about if ${pronounAndPlural(quidData, 0, 'want')} to rest or just a break.*`);

		return await (async function(messageOptions) {
			return interaction.isSelectMenu() ? await update(interaction, messageOptions) : await respond(interaction, messageOptions, true);
		})({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId('travel_rest')
					.setLabel('Rest')
					.setStyle(ButtonStyle.Primary))],
		})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === CurrentRegionType.FoodDen) {

		embed.setDescription(`*${quidData.name} runs to the food den. Maybe ${pronoun(quidData, 0)} will eat something, or put ${pronoun(quidData, 2)} food onto the pile.*`);
		const allFoodDenUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.currentRegion === CurrentRegionType.FoodDen;
				}).length > 0;
			},
		)).map(user => `<@${user.userId[0]}>`).slice(0, 45);
		if (allFoodDenUsersList.length > 0) { embed.addFields({ name: 'Packmates at the food den:', value: allFoodDenUsersList.join('\n') }); }

		return await (async function(messageOptions) {
			return interaction.isSelectMenu() ? await update(interaction, messageOptions) : await respond(interaction, messageOptions, true);
		})({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId('travel_inventory')
						.setLabel('View inventory')
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId('travel_store')
						.setLabel('Store items away')
						.setStyle(ButtonStyle.Primary),
				])],
		})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === CurrentRegionType.MedicineDen) {

		embed.setDescription(`*${quidData.name} rushes over to the medicine den. Nearby are a mix of packmates, some with illnesses and injuries, others trying to heal them.*`);
		const allMedicineDenUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.currentRegion === CurrentRegionType.MedicineDen;
				}).length > 0;
			},
		)).map(user => `<@${user.userId[0]}>`).slice(0, 45);
		if (allMedicineDenUsersList.length > 0) { embed.addFields({ name: 'Packmates at the medicine den:', value: allMedicineDenUsersList.join('\n') }); }
		const allHealerUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.rank !== RankType.Youngling;
				}).length > 0;
			},
		)).map(user => `<@${user.userId[0]}>`).slice(0, 45);
		if (allHealerUsersList.length > 0) { embed.addFields({ name: 'Packmates that can heal:', value: allHealerUsersList.join('\n') }); }

		return await (async function(messageOptions) {
			return interaction.isSelectMenu() ? await update(interaction, messageOptions) : await respond(interaction, messageOptions, true);
		})({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [
				travelComponent,
				...(profileData.rank === RankType.Youngling ? [] : [new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId('travel_heal')
						.setLabel('Heal')
						.setStyle(ButtonStyle.Primary))]),
			],
		})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === CurrentRegionType.Ruins) {

		embed.setDescription(`*${quidData.name} walks up to the ruins, carefully stepping over broken bricks. Hopefully, ${pronoun(quidData, 0)} will find someone to talk with.*`);
		const allRuinsUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.currentRegion === CurrentRegionType.Ruins;
				}).length > 0;
			},
		)).map(user => `<@${user.userId[0]}>`).slice(0, 45);
		if (allRuinsUsersList.length > 0) { embed.addFields({ name: 'Packmates at the ruins:', value: allRuinsUsersList.join('\n') }); }

		return await (async function(messageOptions) {
			return interaction.isSelectMenu() ? await update(interaction, messageOptions) : await respond(interaction, messageOptions, true);
		})({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [travelComponent],
		})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === CurrentRegionType.Lake) {

		embed.setDescription(`*${quidData.name} looks at ${pronoun(quidData, 2)} reflection as ${pronounAndPlural(quidData, 0, 'passes', 'pass')} the lake. Suddenly the ${quidData.displayedSpecies || quidData.species} remembers how long ${pronounAndPlural(quidData, 0, 'has', 'have')}n't drunk anything.*`);

		return await (async function(messageOptions) {
			return interaction.isSelectMenu() ? await update(interaction, messageOptions) : await respond(interaction, messageOptions, true);
		})({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId('travel_drink')
					.setLabel('Drink')
					.setStyle(ButtonStyle.Primary))],
		})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === CurrentRegionType.Prairie) {

		embed.setDescription(`*${quidData.name} approaches the prairie, watching younger packmates testing their strength in playful fights. Maybe the ${quidData.displayedSpecies || quidData.species} could play with them!*`);
		const allPrairieUsersList = (await userModel.find(
			(u) => {
				return Object.values(u.quids).filter(q => {
					const p = q.profiles[interaction.guildId];
					return p && p.currentRegion === CurrentRegionType.Prairie;
				}).length > 0;
			},
		)).map(user => `<@${user.userId[0]}>`).slice(0, 45);
		if (allPrairieUsersList.length > 0) { embed.addFields({ name: 'Packmates at the prairie:', value: allPrairieUsersList.join('\n') }); }

		return await (async function(messageOptions) {
			return interaction.isSelectMenu() ? await update(interaction, messageOptions) : await respond(interaction, messageOptions, true);
		})({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId('travel_play')
					.setLabel('Play')
					.setStyle(ButtonStyle.Primary))],
		})
			.catch((error) => { throw new Error(error); });
	}
	else {

		embed.setDescription(`You are currently at the ${profileData.currentRegion}! Here are the regions you can go to:`);
		embed.setFields([
			{ name: '💤 sleeping dens', value: 'A place to sleep and relax. Go here if you need to refill your energy!' },
			{ name: '🍖 food den', value: 'Inspect all the food the pack has gathered, eat some or add to it from your inventory!' },
			{ name: '🌿 medicine den', value: 'Go here if you need to be healed. Someone will come and help you.' },
			{ name: '🏛️ ruins', value: 'These old stones are a little creepy at night, but at day packmates frequently gather here to talk and meet up.' },
			{ name: '🌊 lake', value: 'Not only do some aquatic packmates live here, but it is also the primary source of fresh water, in case someone is thirsty.' },
			{ name: '🌼 prairie', value: 'This is where the Younglings go to play! Everyone else can also come here and play with them.' },
		]);

		return await (async function(messageOptions) {
			return interaction.isSelectMenu() ? await update(interaction, messageOptions) : await respond(interaction, messageOptions, true);
		})({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [travelComponent],
		})
			.catch((error) => { throw new Error(error); });
	}
}