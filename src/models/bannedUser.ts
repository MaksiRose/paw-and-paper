import { Column, DataType, Model, Table } from 'sequelize-typescript';

interface BannedUserAttribute {
	id: string
}

@Table
export default class BannedUser extends Model<BannedUserAttribute, BannedUserAttribute> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;
}