module.exports = {
	async output(message, error) {

		console.log(`\x1b[32m${message.author.tag}\x1b[0m unsuccessfully tried to execute \x1b[33m${message.content} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		console.error(error);

		await message
			.reply({
				embeds: [{
					title: 'There was an unexpected error executing this command:',
					description: `\`\`\`${error.toString().substring(0, 4090)}\`\`\``,
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
			})
			.catch((newError) => {
				if (newError.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};