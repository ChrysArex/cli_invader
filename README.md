🚀 CLI INVADER
<p align="center"> <img src="https://your-image-url.com" alt="CLI Invader Banner" /> </p>

CLI INVADER is a modern take on the classic Space Invaders game, but with a twist! Instead of battling against AI-controlled aliens, you will engage in thrilling real-time battles against other players connected to the same server. It's a command-line interface (CLI) game that brings multiplayer action right into your terminal.
🕹️ Features

    Multiplayer Battles: Battle against other players in real-time, all connected to the same server.
    Node.js Powered: Built using Node.js for fast and efficient command-line gameplay.
    WebSocket Connection: Uses expressWS for real-time, bi-directional communication between the server and players.
    Battle Logs & Stats: Keep track of your wins, losses, and performance during battles.
    Customization: Manage your player profile, customize your starship, and more.

🚧 Installation

1-Clone the repository:

  ```
  git clone https://github.com/your-username/cli-invader.git

  cd cli-invader
  ```

2-Install the required dependencies:

    npm install

3-Start the server:

    node server

4-Start the Game (in another terminal):

    node index.js

🛠️ Technologies

    Node.js: The entire project is built with Node.js, a powerful server-side JavaScript runtime.
    Express: Used for setting up the server and routing.
    expressWS: Enables real-time WebSocket communication between clients and the server.
    Inquirer.js: Command-line prompts for seamless interaction.
    chalk: Adds some color and style to the terminal output.
    figlet: Creates cool ASCII art for the game banner.

🌍 How to Play

    Once you launch CLI INVADER, you'll be presented with a menu:
        Start a new battle: Connect to the server and engage in a real-time space battle with another player.
        Notifications: Check your notifications for new challenges or messages from other players.
        Settings: Customize your player name, starship, and other preferences.
        Stats: View your battle history, wins, losses, and other stats.
        Help: Learn more about the gameplay and controls.
        Exit: Quit the game.

    When in battle, use the arrow keys to move your starship and space bar to fire at your opponent.

🎮 Controls

    Arrow keys: Move your starship left or right.
    Spacebar: Fire your weapon.
    Escape: Exit the current battle.
