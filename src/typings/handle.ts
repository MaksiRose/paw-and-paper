import { AutocompleteInteraction, MessageContextMenuCommandInteraction, ChatInputCommandInteraction, ButtonInteraction, AnySelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';
import User from '../models/user';
import Server from '../models/server';
import UserToServer from '../models/userToServer';
import Quid from '../models/quid';
import QuidToServer from '../models/quidToServer';
import DiscordUser from '../models/discordUser';
import DiscordUserToServer from '../models/discordUserToServer';

type dataOptions = { user?: User, server?: Server, userToServer?: UserToServer, quid?: Quid<true> | Quid<false>, quidToServer?: QuidToServer; discordUser?: DiscordUser, discordUserToServer?: DiscordUserToServer }

interface Command {
	data: RESTPostAPIApplicationCommandsJSONBody;
	sendMessageComponentResponse?: (interaction: AnySelectMenuInteraction | ButtonInteraction, data: dataOptions) => Promise<void>;
	sendModalResponse?: (interaction: ModalSubmitInteraction, data: dataOptions) => Promise<void>;
}

export interface SlashCommand extends Command {
	category: 'page1' | 'page2' | 'page3' | 'page4' | 'page5' | 'other';
	position: number;
	/** Best practice is that only commands that immediately return without any form of interaction (Button, Select Menu, Modal) that changes something in the database are set to false. */
	disablePreviousCommand: boolean;
	modifiesServerProfile: boolean;
	sendCommand: (interaction: ChatInputCommandInteraction, data: dataOptions) => Promise<void>;
	sendAutocomplete?: (interaction: AutocompleteInteraction, data: dataOptions) => Promise<void>;
	}

export interface ContextMenuCommand extends Command {
	sendCommand: (interaction: MessageContextMenuCommandInteraction) => Promise<void>;
}

export interface Votes {
	token: string;
	authorization: string;
	client: unknown;
}