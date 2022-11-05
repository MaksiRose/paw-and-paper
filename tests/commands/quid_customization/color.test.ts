import {
    CommandInteractionOptionResolver,
    ChatInputCommandInteraction,
    InteractionReplyOptions,
    BaseInteraction,
    EmbedBuilder,
    CacheType,
    Message,
    Client
} from 'discord.js';

import { mock, instance, verify, when, anything, capture } from '@johanblumenberg/ts-mockito';
import { command } from '../../../src/commands/quid_customization/color';
import { QuidSchema, UserData, UserSchema } from '../../../src/typings/data/user';
import { getUserData } from '../../../src/models/userModel';

jest.mock('../../../src/client');

describe(`'color' command tests.`, () => {

    const stubDiscordServerId = 'fakeDiscordServerId';
    const stubQuidId = 'fakeQuidId';
    const fakeUserId = 'fakeUserId';
    const fakeDiscordUser = 'discordUser#fake';

    const stubQuidSchema = (): QuidSchema<''> => ({
        _id: stubQuidId,
        name: 'fakeQuidName',
        nickname: {
            global: 'fakeQuidGlobalNickname',
            servers: {
                [stubDiscordServerId]: 'fakeQuidServerNickname'
            }
        },
        species: '',
        displayedSpecies: '',
        description: '',
        avatarURL: 'https://fake.com/avatar.png',
        pronounSets: [],
        proxy: {
            startsWith: '',
            endsWith: ''
        },
        color: '#000000',
        mentions: {},
        profiles: {}
    });

    const stubUserSchema = (): UserSchema => ({
        userId: [],
        userIds: {
            [fakeDiscordUser]: {
                [stubDiscordServerId]: {
                    isMember: true,
                    lastUpdatedTimestamp: 0
                }
            }
        },
        tag: {
            global: 'fakeUserGlobalTag',
            servers: {
                [stubDiscordServerId]: 'fakeUserServerTag'
            }
        },
        advice: {
            resting: false,
            drinking: false,
            eating: false,
            passingout: false,
            coloredbuttons: false,
            ginkgosapling: false
        },
        settings: {
            reminders: {
                water: false,
                resting: false
            },
            proxy: {
                global: {
                    autoproxy: false,
                    stickymode: false
                },
                servers: {}
            }
        },
        quids: {
            [stubQuidId]: stubQuidSchema()
        },
        currentQuid: {
            [stubDiscordServerId]: stubQuidId
        },
        servers: {},
        lastPlayedVersion: '',
        _id: fakeUserId
    });

    /**
     * Creates the user data for given interaction with mocked {@link UserData.update} method.
     * @param interaction
     * @returns Mocked instance of {@link UserData} class.
     */
    function mockUserData(interaction: BaseInteraction<'cached'>): UserData<undefined, ''> {
        const fakeUserSchema = stubUserSchema();

        const fakeUserData: UserData<undefined, ''> = {
            ...getUserData(fakeUserSchema, interaction.guildId, fakeUserSchema.quids[stubQuidId]),
            
            update: async function(
                updateFunction: (value: UserSchema) => void,
                options: { log?: boolean } = {}
            ): Promise<void> {
    
                updateFunction(fakeUserSchema);
    
                const newUserData = getUserData(fakeUserSchema, interaction.guildId, fakeUserSchema.quids[stubQuidId]);
                
                Object.assign(this, newUserData);
            }
        };

        return fakeUserData;
    }

    /**
     * Mocks the command interaction and its {@link ChatInputCommandInteraction.reply} method.
     * @param resolver - Interacion resolver.
     * @returns Mocked class.
     */
    function mockChatInputCommandInteraction(resolver: Omit<CommandInteractionOptionResolver<'cached'>, 'getMessage' | 'getFocused'>): ChatInputCommandInteraction<'cached'> {
        const InteractionMock = mock(ChatInputCommandInteraction<'cached'>);
        when(InteractionMock.reply(anything())).thenResolve(
            new (Message as any)(new Client({ intents: [] }), {id: '0'})
        );
        when(InteractionMock.replied).thenReturn(false);
        when(InteractionMock.deferred).thenReturn(false);
        when(InteractionMock.guildId).thenReturn(stubDiscordServerId);

        when(InteractionMock.options).thenReturn(resolver);

        return InteractionMock;
    }

    it(`If a valid hex code is entered, it should update the quid color and respond with the proper message.`, async () => {

        const OptionResolverMock = mock(CommandInteractionOptionResolver<CacheType>);
        when(OptionResolverMock.getString('hex')).thenReturn('456789');
        const optionResolver = instance(OptionResolverMock);

        const InteractionMock = mockChatInputCommandInteraction(optionResolver);
        const interaction = instance(InteractionMock);

        const userData = mockUserData(interaction);

        await command.sendCommand(
            interaction,
            userData,
            null
        );

        verify(InteractionMock.reply(anything())).once();
        expect(userData.quid?.color).toEqual('#456789');

        const [firstArg] = capture(InteractionMock.reply).last();
        const replyOptions = firstArg as InteractionReplyOptions;
        const embedBuilder = replyOptions.embeds?.at(0) as (EmbedBuilder | undefined);

        expect(embedBuilder).not.toBeUndefined();
        expect(embedBuilder?.data.title).toEqual('Profile color set to #456789!');
    });

    it(`If an invalid hex code is entered, it should not update the quid color and respond with the proper message.`, async () => {

        const OptionResolverMock = mock(CommandInteractionOptionResolver<CacheType>);
        when(OptionResolverMock.getString('hex')).thenReturn('invalid hex code');
        const optionResolver = instance(OptionResolverMock);

        const InteractionMock = mockChatInputCommandInteraction(optionResolver);
        const interaction = instance(InteractionMock);

        const userData = mockUserData(interaction);

        await command.sendCommand(
            interaction,
            userData,
            null
        );

        verify(InteractionMock.reply(anything())).once();
        expect(userData.quid?.color).toEqual('#000000');

        const [firstArg] = capture(InteractionMock.reply).last();
        const replyOptions = firstArg as InteractionReplyOptions;
        const embedBuilder = replyOptions.embeds?.at(0) as (EmbedBuilder | undefined);

        expect(embedBuilder).not.toBeUndefined();
        expect(embedBuilder?.data.title).toEqual(`Please send a valid hex code! Valid hex codes consist of 6 characters and contain only letters from 'a' to 'f' and/or numbers.`);
    });
});