export interface DiscordEvent {
	/** Name of the event */
	name: string;
	/** Whether the event should be executed once */
	once: boolean;
	execute: (...args: Array<any>) => Promise<void>;
}