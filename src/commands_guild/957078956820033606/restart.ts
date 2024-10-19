import { PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typings/handle';
import cluster from 'node:cluster';
import { killEvents, waitForOperations } from '../../handlers/events';
import { destroyIntervals as killIntervals } from '../../handlers/interval';
import { exec } from 'node:child_process';
import { sequelize } from '../../cluster';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('restart')
		.setDescription('Restart the bot')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.toJSON(),
	category: 'other',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction) => {

		const application = await interaction.client.application.fetch();
		if ((application.owner instanceof User) ? interaction.user.id !== application.owner.id : application.owner ? !application.owner.members.has(interaction.user.id) : false) { return; }

		if (cluster.worker) {

			const { id } = await interaction.deferReply({ fetchReply: true });

			const res = await new Promise<boolean>((resolve, reject) => {
				exec('git pull origin stable && npm update && rm -rf dist && tsc -p tsconfig.json', (error, stdout, stderr) => {
					if (error) {
						console.error(`exec error: ${error}`);
						reject(error);
					}
					else {
						console.log(`stdout: ${stdout}`);
						console.error(`stderr: ${stderr}`);
					}
					resolve(true);
				});
			}).catch(async (reason) => {

				// This is always an editReply
				await respond(interaction, {
					content: `Restart wasn't successful because the command execution failed:\n${reason}`,
				}, 'update', id);
				return false;
			});
			if (res === false) { return; }

			cluster.worker.send({ cmd: 'restart' });
			new Promise<void>((resolve, reject) => {

				const rejectionTimeout = setTimeout(() => {
					reject();
					process.removeListener('message', processFunc);
				}, 600000);

				process.once('message', processFunc);

				async function processFunc(message: {cmd: string}) {

					if (typeof message.cmd === 'string' && message.cmd === 'ready') {

						clearTimeout(rejectionTimeout);
						killEvents();
						killIntervals();

						// This is always an editReply
						await respond(interaction, {
							content: 'Restarted!',
						}, 'update', id);

						await waitForOperations();
						await sequelize.close();
						interaction.client.destroy();
						cluster.worker!.kill();
					}
					else {

						// This is always an editReply
						await respond(interaction, {
							content: `Restart wasn't successful. The primary worker didn't report back with the new worker saying "ready", instead it sent:\n${message}`,
						}, 'update', id);
					}
					process.removeListener('message', processFunc);
					resolve();
				}
			})
				.catch(async () => {

					await respond(interaction, {
						content: 'Restart wasn\'t successful. The primary worker didn\'t report back with the new worker saying "ready", instead it didn\'t report anything for 10 minutes, so the process got aborted.',
					}, 'update', id);
				});
		}
		else {

			// This is always a reply
			await respond(interaction, {
				content: 'A cluster worker object hasn\'t been found. A normal restart will be started.',
			});

			await new Promise<boolean>((resolve, reject) => {
				exec('git pull origin stable && npm update && rm -rf dist && tsc -p tsconfig.json', (error, stdout, stderr) => {
					if (error) {
						console.error(`exec error: ${error}`);
						reject(error);
					}
					else {
						console.log(`stdout: ${stdout}`);
						console.error(`stderr: ${stderr}`);
					}
					resolve(true);
				});
			}).catch(async (reason) => {

				// This is always a followUp
				await respond(interaction, {
					content: `Command execution failed:\n${reason}`,
				});
				return false;
			});

			interaction.client.destroy();
			process.exit();
		}
	},
};