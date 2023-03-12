import { Column, DataType, Model, Table } from 'sequelize-typescript';

interface BannedServerAttributes {
	id: string;
}

@Table
export default class BannedServer extends Model<BannedServerAttributes, BannedServerAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;
}