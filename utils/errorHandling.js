// @ts-check

/**
 * Logs the error and sends a message containing it
 * @param {import('discord.js').Message | import('discord.js').BaseCommandInteraction} command
 * @param {*} error
 */
async function output(command, error) {

	if (command.type === 'DEFAULT' || command.type === 'REPLY' || command.type === 'THREAD_CREATED') {
		console.log(`\x1b[32m${command.author.tag}\x1b[0m unsuccessfully tried to execute \x1b[33m${command.content} \x1b[0min \x1b[32m${command.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
	}
	console.error(error);

	await command
		.reply({
			embeds: [{
				title: 'There was an unexpected error executing this command:',
				description: `\`\`\`${error.toString().substring(0, 4090)}\`\`\``,
				footer: { text: 'If this is the first time you encountered the issue, please report it using the button below. After that, only report it again if the issue was supposed to be fixed after an update came out. To receive updates, ask a server administrator to do the "getupdates" command.' },
			}],
			components: [{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'report',
					label: 'Report',
					style: 'SUCCESS',
				}],
			}],
			failIfNotExists: false,
		})
		.catch((newError) => {
			console.error(newError);
		});
}

module.exports.output = output;