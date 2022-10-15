import userModel from '../models/userModel';
import { Profile, Quid, UserSchema } from '../typedef';
import { getMapData } from './helperFunctions';

type OmitFirstArgAndChangeReturn<F, Return> = F extends (x: any, ...args: infer P) => any ? (...args: P) => Return : never
export interface PlayerQuid<isCompleted extends boolean = boolean> extends Omit<Quid<isCompleted>, 'nickname' | 'profiles'> {
		nickname: Omit<Quid<isCompleted>['nickname'], 'servers'> & {
			server: Quid<isCompleted>['nickname']['servers'][string] | undefined;
		},
		profile: Profile
	}
interface Player<hasQuid extends boolean = boolean, isCompleted extends boolean = boolean> extends Omit<UserSchema, 'quids' | 'currentQuid' | 'tag' | 'settings'> {
	tag: Omit<UserSchema['tag'], 'servers'> & {
		server: UserSchema['tag']['servers'][string] | undefined;
	},
	quid: hasQuid extends true ? PlayerQuid<isCompleted> : PlayerQuid<isCompleted> | undefined,
	settings: Omit<UserSchema['settings'], 'proxy'> & {
		proxy: Omit<UserSchema['settings']['proxy'], 'servers'> & {
			server: UserSchema['settings']['proxy']['servers'][string] | undefined;
		}
	},
	update: OmitFirstArgAndChangeReturn<typeof userModel['findOneAndUpdate'], Promise<void>>
}

export class PlayerData implements Player {
	_id!: Player['_id'];
	userId!: Player['userId'];
	tag!: Player['tag'];
	advice!: Player['advice'];
	settings!: Player['settings'];
	quid: Player['quid'];
	lastPlayedVersion!: Player['lastPlayedVersion'];
	update!: (updateFunction: (value: UserSchema) => void) => Promise<void>;

	constructor(userData: UserSchema, server_id?: string) {

		return {
			...definePlayer(userData, server_id),
			update: async function(
				updateFunction: (value: UserSchema) => void,
			): Promise<void> {

				userData = await userModel.findOneAndUpdate(
					u => u._id === userData._id,
					updateFunction,
				);
				const player = definePlayer(userData, server_id);
				Object.assign(this, player);
			},
		};
	}
}

function definePlayer(
	userData: UserSchema,
	server_id = '',
): Omit<Player, 'update'> {

	const quidData = userData.quids[userData.currentQuid[server_id] ?? ''];
	return {
		_id: userData._id,
		userId: userData.userId,
		tag: {
			global: userData.tag.global,
			server: userData.tag.servers[server_id],
		},
		advice: userData.advice,
		settings: {
			reminders: userData.settings.reminders,
			proxy: {
				global: userData.settings.proxy.global,
				server: userData.settings.proxy.servers[server_id],
			},
		},
		quid: quidData === undefined ? undefined : {
			_id: quidData._id,
			name: quidData.name,
			nickname: {
				global: quidData.nickname.global,
				server: quidData.nickname.servers[server_id],
			},
			species: quidData.species,
			displayedSpecies: quidData.displayedSpecies,
			description: quidData.description,
			avatarURL: quidData.avatarURL,
			pronounSets: quidData.pronounSets,
			proxy: quidData.proxy,
			color: quidData.color,
			mentions: quidData.mentions,
			profile: getMapData(quidData.profiles, server_id),
		},
		lastPlayedVersion: userData.lastPlayedVersion,
	};
}