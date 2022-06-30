"use strict";
// @ts-check
const { readdirSync, lstatSync } = require('fs');
const path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, test_guild_id } = require('../../config.json');
/**
 * Adds all the commands to the client
 * @param {import('../paw').client} client
 */
module.exports.execute = (client) => {
    /** @type {Array<import('discord-api-types/v9').RESTPostAPIApplicationCommandsJSONBody>} */
    const commands = [];
    for (const commandPath of getFiles('../commands')) {
        /** @type {{name: string, aliases: Array<string>, data: import("@discordjs/builders").SlashCommandBuilder | {name: string, type: number}, sendMessage: Function, sendCommand: Function}} */
        const command = require(commandPath);
        if (command.data !== undefined) {
            commands.push(JSON.parse(JSON.stringify(command.data)));
        }
        client.commands[command.name] = command;
    }
    if (client.token && client.user) {
        const rest = new REST({ version: '9' }).setToken(client.token);
        rest
            .put(client.token === token ? Routes.applicationCommands(client.user.id) : Routes.applicationGuildCommands(client.user.id, test_guild_id), { body: commands })
            .catch(console.error);
    }
};
/**
 * Adds all file paths in a directory to an array and returns it
 * @param {string} directory
 * @returns {Array<string>} Array of file paths
 */
function getFiles(directory) {
    /**
     * @type {Array<string>}
     */
    let commandFiles = [];
    for (const content of readdirSync(path.join(__dirname, directory))) {
        if (lstatSync(path.join(__dirname, `${directory}/${content}`)).isDirectory()) {
            commandFiles = [
                ...commandFiles,
                ...getFiles(`${directory}/${content}`),
            ];
        }
        else if (content.endsWith('.js')) {
            commandFiles.push(`${directory}/${content.slice(0, -3)}`);
        }
    }
    return commandFiles;
}
