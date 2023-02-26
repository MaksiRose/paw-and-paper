import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, HasMany, HasOne, Model, Table } from 'sequelize-typescript';
import Friendship from './friendship';
import Group from './group';
import GroupToQuid from './groupToQuid';
import QuidToServer from './quidToServer';
import Server from './server';
import User from './user';
import UserToServer from './userToServer';
import Webhook from './webhook';
const { default_color } = require('../../config.json');

@Table
export default class Quid extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => User)
	@Column({ type: DataType.STRING })
	declare userId: string;

	@BelongsTo(() => User, { foreignKey: 'userId' })
	declare user: User;

	@ForeignKey(() => Group)
	@Column({ type: DataType.STRING })
	declare mainGroupId: string | null;

	@BelongsTo(() => Group)
	declare group: Group;

	@Column({ type: DataType.STRING })
	declare name: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare nickname: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare species: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare displayedSpecies: string;

	@Column({ type: DataType.TEXT, defaultValue: '' })
	declare description: string;

	@Column({ type: DataType.STRING, defaultValue: 'https://cdn.discordapp.com/embed/avatars/1.png' })
	declare avatarURL: string;

	@Column({ type: DataType.ARRAY(DataType.ARRAY(DataType.STRING)), defaultValue: [['they', 'them', 'their', 'theirs', 'themselves', 'plural']] })
	declare pronouns_en: string[][];

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare noPronouns_en: boolean;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare proxy_startsWith: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare proxy_endsWith: string;

	@Column({ type: DataType.STRING, defaultValue: default_color })
	declare color: string;

	@HasMany(() => Friendship, { foreignKey: 'quidId_1' })
	declare friendships_1: Friendship[];

	@HasMany(() => Friendship, { foreignKey: 'quidId_2' })
	declare friendships_2: Friendship[];

	@BelongsToMany(() => Group, () => GroupToQuid)
	declare groups: Group[];

	@BelongsToMany(() => Server, () => QuidToServer)
	declare servers: Server[];

	@HasOne(() => User, { foreignKey: 'proxy_lastGlobalProxiedQuidId', onDelete: 'SET NULL' })
	declare lastGlobalProxyOf?: User;

	@HasMany(() => UserToServer, { foreignKey: 'lastProxiedQuidId' })
	declare lastProxiedIn: UserToServer[];

	@HasMany(() => UserToServer, { foreignKey: 'activeQuidId' })
	declare activeIn: UserToServer[];

	@HasMany(() => Webhook, { foreignKey: 'quidId' })
	declare webhooks: Webhook[];
}