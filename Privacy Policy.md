Paw and Paper is a software application (the "Bot") that runs automated tasks to enhance the user experience on the chat service [Discord](https://discordapp.com).
It behaves and looks similar to a user account, but uses the [official Discord API](https://discord.com/developers/docs/intro).

The following is the Privacy Policy that outlines the collection of data from this Bot and any other service we may provide (the "Services").
It is a binding contract between the User ("you") and Paw and Paper ("us").
Using the Services means that you agree to the Privacy Policy, and the Privacy Policy continue to apply for as long as you use the Services.

If you have questions or concerns regarding the Privacy Policy, you can contact us on our [Discord Server](https://discord.gg/9DENgj8q5Q) or via email: maksilucy1@gmail.com.

# Data Collected

"In-game" refers to information that is relevant within and by using the Service, it relates to events that are tied to part of the experience the Service provides. Specifically, the Service features a text-based roleplay game in which you do tasks and complete minigames provided through Discord interactions (such as buttons and select menus).

The Service does not collect or store any data from you until you create an account. An account is created when using the `name` command.

The Service collects and stores the following data in its database:

- Information about Server Accounts:
  - The server ID provided by Discord<sup>1</sup>
  - The name of the server as set in Discord<sup>1</sup>
  - A list of in-game items with the amount the server has of them<sup>2</sup>
  - A list of in-game dens and their status<sup>2</sup>
  - A timestamp for the next possible in-game attack<sup>2</sup>
  - If given, the channel ID provided by Discord of the channel that will be used for in-game visits<sup>2</sup>
  - If given, the server ID provided by Discord of another server that is currently in-game visiting this server<sup>3</sup> <sup>4</sup>
  - A list of in-game shop roles, with their role ID provided by Discord, their in-game way of earning and their in-game requirement<sup>3</sup>
  - A list of channel IDs where proxying is blacklisted, a list of channel IDs where proxying is whitelisted, whether the blacklist or whitelist is in use, a list of role IDs where proxying is blacklisted, a list of role IDs where proxying is whitelisted, whether the blacklist or whitelist is in use, whether a tag is required, a list of words that are required in the tag, whether the tag must be in the members displayed name, a channel ID where logging messages are sent, if set by server administrators. A proxy is a set of characters indicating to the bot whether a message should be replaced to look like it is coming from an in-game quid<sup>4</sup>
  - A list of "skills" or server administrators have created. Skills are attributes given to quids to measure their abilities, often used in roleplay to learn more about a quid or to enhance gameplay<sup>2</sup>
  - A universally unique identifier<sup>1</sup>
- Information about User Accounts:
  - A list of user IDs provided by Discord of the user that created / users that were added to the account<sup>1</sup>
  - A list of kinds of advice messages and if the user has received them<sup>2</sup>
  - A list of settings and if the user has enabled them<sup>4</sup>
  - For each quid:
    - A unique identifier given to that quid<sup>1</sup>
    - The in-game name of the account chosen by the user<sup>2</sup>
    - The in-game species chosen by the user<sup>2</sup>
	- The in-game displayed species chosen by the user<sup>2</sup>
    - The in-game description of the account chosen by the user<sup>2</sup>
    - The in-game avatar URL chosen by the user, by default this is the following link: https://cdn.discordapp.com/embed/avatars/1.png<sup>2</sup>
    - The in-game pronoun sets chosen by the user<sup>2</sup>
	- The ingame "proxy" prefix and/or suffix chosen by a user. A proxy is a set of characters indicating to the bot whether a message should be replaced to look like it is coming from an in-game quid<sup>2</sup>
    - The in-game color, a hex-code chosen by the user<sup>2</sup>
	- A list of quid IDs, each linking to a list of timestamps that describe when that quid has been mentioned by this user<sup>2</sup>
	- For each profile (quid information unique to each server):
	  - The server ID provided by Discord of the server this account was created on<sup>1</sup>
      - The in-game rank the user has achieved<sup>2</sup>
      - The in-game levels<sup>2</sup>
      - The in-game experience<sup>2</sup>
      - The in-game health and maximum health<sup>2</sup>
      - The in-game energy and maximum energy<sup>2</sup>
      - The in-game hunger and maximum hunger<sup>2</sup>
      - The in-game thirst and maximum thirst<sup>2</sup>
      - Whether the user is resting in-game<sup>2</sup>
      - Whether the user is on an in-game cooldown<sup>2</sup>
      - Whether the user has an in-game quest<sup>2</sup>
      - The in-game current region<sup>2</sup>
      - The in-game unlocked ranks<sup>2</sup>
      - Information about the in-game "ginkgo" sapling, including:
        - Whether it exists<sup>2</sup>
        - Its health<sup>2</sup>
        - How often it has been watered<sup>2</sup>
		- Whether a reminder has been sent<sup>2</sup>
		- Whether a gentle reminder has been sent<sup>2</sup>
        - A timestamp of the next optimal watering time<sup>2</sup>
        - A channel ID provided by Discord of the channel it has last been watered in<sup>4</sup>
      - A list of potential in-game injuries/illnesses the user may have<sup>2</sup>
      - A list of in-game items with the amount the user has of them<sup>2</sup>
      - A list of in-game shop roles, with their role ID provided by Discord, their in-game way of earning and their in-game requirement, that the user earned<sup>2</sup>
  - A universally unique identifier<sup>1</sup>
- A list of users (via their user ID provided by Discord) and servers (via their server ID provided by Discord) that are prohibited from using this Service.<sup>1</sup>
- A list of user accounts (via their universally unique identifier) and server accounts (via their universally unique identifier) that are going to be deleted, with a timestamp of their deletion date<sup>1</sup>
- A list of users (via their user ID provided by Discord) with a list of timestamps relating to the last recorded and next redeemable "vote" on various third-party websites that the Bot is registered. Votes are used to recommend the Bot to users on those third-party websites, and voting will give users in-game rewards.<sup>2</sup>
- A list of webhook messages sent by the Bot via their message ID provided by Discord with the user ID provided by Discord of the user that caused this webhook message to be sent. Other information like the messages content, the channel or server ID's provided by Discord etc. is not stored.<sup>5</sup>

This is why we need and how we use the data:
1. This information is stored to uniquely identify a party, such as you, your quids, or server. It is used to relate the information stored with it to that party.
2. This information is stored to save progress users have made when using the in-game features. It is displayed when using in-game features.
3. This information is stored to enable the in-game visiting feature. It is used to connect servers/channels with each other.
4. This information is stored as a setting that you made. It is used to enable or disable features related to that setting.
5. This information is stored for moderation purposes. It is displayed when other users want to know which user triggered the webhook message to be sent.

We may update this Privacy Policy.

Updates to the Privacy Policy may be communicated through new [Releases](https://github.com/MaksiRose/paw-and-paper/releases) on this GitHub repository, as well as through [published](https://support.discord.com/hc/en-us/articles/360032008192-Announcement-Channels-) posts in the "updates" channel (channel ID: 958847056133378068) on our [Discord Server](https://discord.gg/9DENgj8q5Q).

Updates are effective with the update of the Bot to that release or any release newer than it.
The current release version of the Bot can be checked using the `help` command under the section "Bot".

You can request any data that we collect about you, as well as the deletion of that data. Request of this kind go to this email: maksilucy1@gmail.com

To delete all your data, you can also use the `delete` command, click "Everything", then click "Confirm".