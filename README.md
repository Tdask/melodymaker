Welcome to Neural Melody Maker! 

Create a melody by clicking the pads and listen to it by hitting the 'Play' button.

Use the 'Build Melody' button to send your melody through a Recurrent Neural Network, which will output a new melody based on the one you gave it.

Keep pressing 'Build Melody' to continually use the generated sequence as the next seed, and hear how your melody develops and changes over time. 

The 'Heat' number determines how far away from the original input we can go. The higher the 'Heat' number, the more random the generated melody will sound compared to the original.

Please be patient during the automatic initialization – it'll get there!

This app uses Magenta.js's pre-trained MusicRNN model, read more about that and the Magenta project here:
https://tensorflow.github.io/magenta-js/music/demos/music_rnn.html
https://magenta.tensorflow.org/get-started/

With thanks to Mark Mur and his React sequencer
https://github.com/markmur/react-sequencer
