import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Quid from './quid';
import Server from './server';
import { Optional } from 'sequelize';

interface QuidToServerAttributes {
	id: string;
	quidId: string;
	serverId: string;
	nickname: string;
}

type QuidToServerOptionalAttributes = Optional<QuidToServerAttributes, 'nickname'>

@Table
export default class QuidToServer extends Model<QuidToServerAttributes, QuidToServerOptionalAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING })
	declare quidId: string;

	// Not sure if this is legal
	@BelongsTo(() => Quid, { foreignKey: 'quidId' })
	declare quid: Quid;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	// Not sure if this works
	@BelongsTo(() => Server, { foreignKey: 'serverId' })
	declare server: Server;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare nickname: string;
}