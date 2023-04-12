import { GuildTextBasedChannel, User } from 'discord.js';
import Server from '../models/server';

export function explainRuleset(
	ruleset: string,
): string {

	const rules = ruleset.split('\n');

	const modifiedRules = rules.map(rule => {

		return rule
			.split(/(@displayname)/)
			.filter(str => str.length > 0)
			.map((subrule, index, subrules) => {

				if (subrule === '@displayname' && index === 0 && subrules.length <= 1) { subrule = 'a word from your displayname'; }
				else if (subrule === '@displayname' && index === 0 && subrules.length > 1) { subrule = 'a word from your displayname + '; }
				else if (subrule === '@displayname' && index > 0 && index === (subrules.length - 1)) { subrule = ' + a word from your displayname'; }
				else if (subrule === '@displayname' && index > 0) { subrule = ' + a word from your displayname + '; }
				else if (subrule !== '@displayname') { subrule = `"${subrule}"`; }

				return subrule;
			})
			.join('');
	});

	return modifiedRules.join(' and ');
}

export async function ruleIsBroken(
	channel: GuildTextBasedChannel,
	discordUser: User,
	server: Server,
	quidName: string,
): Promise<boolean> {

	const guildMember = await channel.guild.members.fetch(discordUser.id);
	const displayName = guildMember.displayName;
	let followsRuleSets = false;
	for (const ruleSet of server.nameRuleSets) {

		const newRuleSet = ruleSet.split('\n').map(rule => {

			const displayNameWords = displayName.split(' ');
			const numDisplayNameWords = displayNameWords.length;
			const numDisplayNames = (rule.match(/@displayname/g) || []).length;
			const permutations = Math.pow(numDisplayNameWords, numDisplayNames);
			const newRulePossibilities: string[] = [];

			for (let i = 0; i < permutations; i++) {
				let permutation = rule;
				for (let j = 0; j < numDisplayNames; j++) {
					const wordIndex = Math.floor(i / Math.pow(numDisplayNameWords, j)) % numDisplayNameWords;
					permutation = permutation.replace('@displayname', displayNameWords[wordIndex]!);
				}
				newRulePossibilities.push(permutation);
			}

			for (const newRule of newRulePossibilities) {

				if (quidName.includes(newRule)) { return true; }
			}
			return false;
		});

		if (newRuleSet.every(v => v === true)) {

			followsRuleSets = true;
			break;
		}
	}
	return !followsRuleSets;
}