import { Column, DataType, Model, Table } from 'sequelize-typescript';

interface BannedServersAttributes {
	id: string;
}

@Table
export default class BannedServers extends Model<BannedServersAttributes, BannedServersAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;
}