import { Op } from 'sequelize';
import { sendReminder } from '../commands/gameplay_maintenance/water-tree';
import Quid from '../models/quid';
import QuidToServer from '../models/quidToServer';
import { hasNameAndSpecies } from '../utils/checkUserState';

/** It updates each profile to have no cooldown, not rest, and maximum energy, and then it executes the sendReminder function for each profile for which the sapling exists and where lastMessageChannelId is a string, if the user has enabled water reminders */
export async function execute(
): Promise<void> {

	const quidsToServers = await QuidToServer.findAll({
		where: {
			sapling_exists: true,
			sapling_sentReminder: false,
			sapling_lastChannelId: { [Op.not]: null },
		},
	});
	for (const quidToServer of quidsToServers) {

		const quid = await Quid.findByPk(quidToServer.quidId);

		if (hasNameAndSpecies(quid)) { await sendReminder(quidToServer); }
	}
}