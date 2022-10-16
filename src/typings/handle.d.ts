import { AutocompleteInteraction, MessageContextMenuCommandInteraction, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';

export interface SlashCommand {
	data: RESTPostAPIApplicationCommandsJSONBody;
	category: 'page1' | 'page2' | 'page3' | 'page4' | 'page5' | 'other';
	position: number;
	/** Best practice is that only commands that immediately return without any form of interaction (Button, Select Menu, Modal) that changes something in the database are set to false. */
	disablePreviousCommand: boolean;
	modifiesServerProfile: boolean;
	sendCommand: (interaction: ChatInputCommandInteraction, userData: UserSchema | null, serverData: ServerSchema | null, embedArray: Array<EmbedBuilder>) => Promise<void>;
	sendAutocomplete?: (interaction: AutocompleteInteraction, userData: UserSchema | null, serverData: ServerSchema | null) => Promise<void>;
}

export interface ContextMenuCommand {
	data: RESTPostAPIApplicationCommandsJSONBody;
	sendCommand: (interaction: MessageContextMenuCommandInteraction) => Promise<void>;
}

export interface Votes {
	token: string;
	authorization: string;
	client: unknown;
}