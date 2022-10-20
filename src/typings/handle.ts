import { AutocompleteInteraction, MessageContextMenuCommandInteraction, ChatInputCommandInteraction, ButtonInteraction, SelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';
import { UserData } from './data/user';
import { ServerSchema } from './data/server';

interface Command {
	data: RESTPostAPIApplicationCommandsJSONBody;
	sendMessageComponentResponse?: (interaction: SelectMenuInteraction | ButtonInteraction, userData: UserData<undefined, ''> | null, serverData: ServerSchema | null) => Promise<void>;
	sendModalResponse?: (interaction: ModalSubmitInteraction, userData: UserData<undefined, ''> | null, serverData: ServerSchema | null) => Promise<void>;
}

export interface SlashCommand extends Command {
	category: 'page1' | 'page2' | 'page3' | 'page4' | 'page5' | 'other';
	position: number;
	/** Best practice is that only commands that immediately return without any form of interaction (Button, Select Menu, Modal) that changes something in the database are set to false. */
	disablePreviousCommand: boolean;
	modifiesServerProfile: boolean;
	sendCommand: (interaction: ChatInputCommandInteraction, userData: UserData<undefined, ''> | null, serverData: ServerSchema | null) => Promise<void>;
	sendAutocomplete?: (interaction: AutocompleteInteraction, userData: UserData<undefined, ''> | null, serverData: ServerSchema | null) => Promise<void>;
	}

export interface ContextMenuCommand extends Command {
	sendCommand: (interaction: MessageContextMenuCommandInteraction) => Promise<void>;
}

export interface Votes {
	token: string;
	authorization: string;
	client: unknown;
}