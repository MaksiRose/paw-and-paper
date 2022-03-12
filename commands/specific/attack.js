const startTimeMap = new Map();

module.exports = {
	name: 'attack',
	startAttack(message) {

		startTimeMap.set('nr' + message.guild.id, Date.now());
		setTimeout(async function() {

			await message.channel
				.send({ content: 'Attack starts now!' })
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			startTimeMap.delete('nr' + message.guild.id);
		}, 60000);
	},
	remindOfAttack(message) {

		return startTimeMap.has('nr' + message.guild.id) ? `Humans will attack in ${Math.floor((60000 - (Date.now() - startTimeMap.get('nr' + message.guild.id))) / 1000)} seconds!` : null;
	},
};