# Halloween Window Display

A shadowy woman appears in an upstairs window. She wanders past, vanishes, comes back and presses her hand against the glass. A gang of fuzzy, googly-eyed creatures crowds the window to stare out at the street, Mochi the dog trots up and turns into a glowing green-eyed ghost-dog, and later in the evening a glowing neon monster joins them, along with something that stands very still at the back of the room… until it doesn't. In November, Mochi comes back in a pilgrim hat, between views of an autumn sunset that fades into a moonlit night.

It's a portrait TV standing behind a sheer curtain, driven by a Mac that plays AI-generated videos on a schedule: gentler ones while kids are out trick-or-treating, scarier ones later in the evening. The videos change with the seasons: Halloween, Thanksgiving, Christmas.

<table align="center">
  <tr>
    <td align="center"><img src="docs/images/from-the-street.jpg" width="300" alt="At night from the street: an upstairs window glows, with the dark silhouette of a woman standing in it"></td>
    <td align="center"><img src="docs/images/hero.jpg" width="300" alt="Close-up of the video: the woman's silhouette with her palm pressed against the glass"></td>
  </tr>
  <tr>
    <td align="center"><em>What trick-or-treaters see from the street</em></td>
    <td align="center"><em>What's playing on the TV</em></td>
  </tr>
</table>

**Contents**

1. [How it works](#how-it-works)
2. [What's playing](#whats-playing)
3. [The videos](#the-videos)
4. [Set it up](#set-it-up)
5. [Using it](#using-it)
6. [If something's wrong](#if-somethings-wrong)

## How it works

![Side view of the setup: viewer on the street, window, sheer curtain, portrait TV, Mac](docs/images/physical-setup.svg)

A Mac plays videos full-screen on a TV standing upright in the window, with a sheer curtain in front to hide the screen's edges. Two things decide what's on screen:

- **The season**, from the date: Halloween videos in October, Thanksgiving in November, Christmas in December.
- **The time of day**: gentler "kid" videos in the early morning and early evening, scarier "grownup" ones later, and a black screen the rest of the time.

The videos are kept in this repo, and the Mac picks up the latest at every login.

## What's playing

| Season | When | Videos |
|---|---|---|
| Halloween | Every day in October | Kid hours: the fuzzy creatures and Mochi the ghost-dog. Grownup hours: those two plus the monster, the jump scare and the woman |
| Thanksgiving | Fridays and Saturdays in November until Thanksgiving, then the day before and Thanksgiving Day itself | The fall sunset and Mochi the pilgrim, all evening |
| Christmas | December | None yet, so the window stays black |

Each day:

| Time | Playing |
|---|---|
| 5–7 am | Kid videos |
| 5–7:30 pm | Kid videos |
| 7:30–11 pm | Grownup videos |
| Any other time | Black |

On a day outside every season, the window stays black. The dates and times can be changed; they're set near the top of `scheduler/video_scheduler.js`.

## The videos

**Halloween**

| Video | Plays | Length |
|---|---|---|
| **Fuzzy creatures:** a gang of shaggy, googly-eyed creatures runs around the room, then crowds the window, faces pressed to the glass | Kid and grownup hours | 0:20 |
| **Mochi the ghost-dog:** Mochi, a real fluffy white dog, trots up to the window and turns into a friendly ghost-dog with glowing green eyes and little horns, then floats away | Kid and grownup hours | 0:20 |
| **Neon monster:** a glowing neon monster comes right up to the glass and stares out | Grownup hours | 0:20 |
| **Jump scare:** a pale, gaunt figure stands motionless far back in the dark for a long moment, then suddenly charges and slams against the glass, its screaming face filling the window. No blood | Grownup hours | 0:20 |
| **The woman:** a shadowy woman walks past, presses her hand to the glass, and keeps coming back | Grownup hours | 1:33 |

**Thanksgiving**

| Video | Plays | Length |
|---|---|---|
| **Fall sunset:** the sun sinks into the hills behind red maples losing their leaves, wind blows leaves across the window, then the sky fades through purple to deep blue and a pale moon rises over the field | All evening | 0:25 |
| **Mochi the pilgrim:** Mochi trots up in a little pilgrim hat, gazes out at the street, then spots a floating roast drumstick and chases it out of frame | All evening | 0:20 |

The videos play one after another and start over, each fading in from black and back out, so there's no visible jump between them.

### How they were made

The videos were made in a conversation with [Claude](https://claude.ai), Anthropic's AI assistant, connected to [Higgsfield](https://higgsfield.ai), an AI video service. The ideas were described in plain words ("a woman who's just a dark silhouette, walking in and out of the window"); Claude wrote the detailed prompts, made the videos on Higgsfield, and edited them (making her bigger, lowering her to window height, adding a flicker to make it scarier) until they looked right. For the Mochi videos, a photo of the real dog was used so the video shows him rather than any white dog.

### What it cost

**About $143 for the videos**, plus a **Claude subscription** (from $20 a month). Prices in US dollars, as of November 2026.

| Video | Cost |
|---|---|
| The woman (two clips, plus a first try that came out too small) | $33.97 |
| Neon monster | $13.07 |
| Fuzzy creatures | $17.78 |
| Mochi the ghost-dog | $17.78 |
| Jump scare | $17.78 |
| Mochi the pilgrim | $18.82 |
| Fall sunset (two clips) | $23.53 |
| **Total** | **$142.73** |

Higgsfield charges for each clip it makes, by its length; editing afterwards is free. Claude is a flat monthly subscription (Pro is $20 a month; Max at $100 and Ultra at $200 give more room for long sessions like this one), so writing the prompts, editing the videos and building the scheduler cost nothing extra.

Sources: [Higgsfield pricing](https://higgsfield.ai/blog/higgsfield-pricing-explained) · [Claude plans & pricing](https://claude.com/pricing)

### The prompts

What was asked for, word for word. The woman's video is two clips joined together, and so is the fall dusk.

**Fall dusk (15 s)**

> Static locked-off camera, vertical frame, a classic New England autumn landscape at dusk, seen as if looking out of a window. In the foreground and middle ground, tall old maple and oak trees in full fall color, deep red, burnt orange and gold, already half bare, with dark branches showing through. Beyond them a gently rolling field of long golden grass and a distant line of hills. The sun is low and failing, a large soft orange disc sinking toward the hills, casting long shadows and a warm red-orange glow across the horizon, the sky fading from amber near the horizon to deep violet and dusky blue above, a few streaky clouds lit pink and orange. A steady autumn wind blows: branches sway, leaves loosen and break away from the trees, and many red, orange and yellow leaves drift, flutter and tumble through the air across the frame, some passing close to the camera, the long grass ripples in waves. Slowly, over the clip, the light dims a little as the sun sinks lower. Peaceful, nostalgic, cinematic, rich warm colors, photorealistic, no people, no animals, no buildings, no text, no camera movement.

**Fall dusk, continuing into night (10 s)**, carrying on from the end of the dusk clip

> Continue the same shot exactly: the same static locked-off camera, the same autumn landscape with the red maples, the rolling golden field and the distant hills, the same framing. The sun keeps sinking and slips completely below the hills; the last sliver of orange disappears. The red-orange glow on the horizon fades to a thin band of deep amber, then to dusky purple and finally deep navy blue night. The trees and hills turn into dark silhouettes against the sky. Stars slowly appear and twinkle across the darkening sky, and a soft pale moon glows low in the sky, casting faint silver light on the field. The wind keeps blowing: branches sway, and leaves keep drifting and tumbling through the air, now catching faint moonlight. Ends on a calm, peaceful, dark autumn night. Smooth, gradual, photorealistic, no people, no animals, no buildings, no text, no camera movement.

**Mochi the pilgrim (20 s)**, with a photo of Mochi

> The dog is the small white fluffy dog from the reference image: curly bright white coat, round fluffy head, floppy ears, dark round eyes, black button nose, plumed curly tail. Keep his exact look and breed. Ignore the room, couch and poster in the reference. Static locked-off camera, vertical frame, pure black background, no environment, no floor. The camera is right at a window looking into a dark room. The video begins on an empty, fully black frame. The little white dog appears far back in the darkness, warmly lit by a soft golden autumn glow, wearing a small black pilgrim hat with a shiny gold buckle, and happily trots toward the window, tail wagging, ears bouncing. He arrives right at the glass, extremely close to camera, his fluffy face filling most of the frame under the little pilgrim hat, nose pressed to the glass, big hopeful eyes, tilting his head at the street, adorable and funny. Then a golden roasted turkey drumstick floats slowly through the air just in front of him. His eyes lock onto it, his ears perk up, and he spins around and bounds off after it, chasing it excitedly out of frame. The frame fades back into darkness. The final seconds are an empty, fully black frame, identical to the opening. Warm cozy Thanksgiving mood, playful and funny, kid-friendly, warm golden and amber light on pure black, high contrast, no text, no humans, no other animals, no camera movement.

**Jump scare (20 s)**

> Static locked-off camera, vertical frame, pure black background, no environment, no floor, no light sources. The camera is right at a window looking into a pitch-dark room. The video begins on an empty, fully black frame. Slowly, far at the very back of the darkness, a tall pale gaunt figure becomes barely visible, standing perfectly still, arms hanging limp, head slightly tilted, faint cold grey light on its pale skin, so faint you are not sure it is there. It stays completely motionless for a long, tense moment. Then, without warning, it suddenly sprints straight at the camera at terrifying, unnatural speed, jerky and twitching, and SLAMS against the glass, extremely close to camera: its face fills the entire frame, an emaciated ash-white face with cracked dry skin, completely black hollow eyes with no pupils, jaw stretched impossibly wide open in a silent scream, stringy dark hair, long bony spidery fingers splayed and slapping against the glass on both sides of the face. It stays pressed against the glass, twitching violently, head jerking, staring straight into the viewer. Then it snaps backward into the darkness in an instant and is gone, leaving pitch black. The final seconds are an empty, fully black frame, identical to the opening. Horror jump scare, terrifying, sudden, cold desaturated grey tones on pure black, high contrast, no blood, no gore, no wounds, no text, no other people, no camera movement.

**Mochi the ghost-dog (20 s)**, with a photo of Mochi

> The dog is the small white fluffy dog from the reference image: curly bright white coat, round fluffy head, floppy ears, dark round eyes, black button nose, plumed curly tail. Keep his exact look and breed. Ignore the room, couch and poster in the reference. Static locked-off camera, vertical frame, pure black background, no environment, no floor, no light sources. The camera is right at a window looking into a pitch-dark room. The video begins on an empty, fully black frame. The little white dog appears far back in the darkness, small, softly lit, and happily trots toward the window, tail wagging. As he gets closer he magically transforms into a friendly cartoon ghost-dog: his white fur becomes softly translucent and glows a gentle pale blue-white with wisps of ghostly mist trailing off his fur, his eyes light up bright glowing green, and two small rounded stubby horns sprout on top of his head. Cute and funny, not scary. He arrives right at the glass, extremely close to camera, his fluffy glowing ghost face filling most of the frame, green eyes glowing, tilting his head curiously, nose squishing against the glass and fogging it with a breath, giving a goofy happy grin. He holds there, peering out at the street. Then he floats backward into the darkness of the room, his glow fading and shrinking until he dissolves completely into the black. The final seconds are an empty, fully black frame, identical to the opening. Playful, funny, gently spooky Halloween for kids, high contrast on pure black, no text, no humans, no other animals, no camera movement.

**Fuzzy creatures (20 s)**

> Static locked-off camera, vertical frame, pure black background, no environment, no floor, no light sources. The camera is right at a window looking into a pitch-dark room. The video begins on an empty, fully black frame. A gang of six shaggy, fuzzy, handmade puppet-like creatures appears in the darkness of the room: long wild shaggy fur in vivid saturated colors, one lime green, one hot pink, one electric blue, one bright orange, one purple, one yellow; big round googly eyes with small black pupils, wide floppy felt mouths, some with little horns, antennae or droopy ears, gangly arms. They are lit only by soft colored rim light against pitch black. They scamper and run around the room behind the glass, tumbling, bouncing, chasing each other and bumping into one another, playful and chaotic. Then all at once they notice the window, freeze, and rush forward together, converging on the glass and crowding against it, extremely close to camera: their fuzzy faces fill the entire frame from edge to edge, squished together, fur pressed against the glass, big googly eyes peering out at the street, blinking, mouths agape, jostling for space, mischievous and curious. They hold there, staring out. Then they slowly back away together, retreating into the darkness of the room, shrinking and fading until they dissolve completely into the black. The final seconds are an empty, fully black frame, identical to the opening. Handcrafted fuzzy puppet aesthetic, playful but eerie Halloween mood, high contrast, saturated colors on pure black, no text, no humans, no camera movement.

**The woman, walking (20 s)**

> Static locked-off camera, vertical frame, pure black background, no environment, no floor, no light sources. The camera is right at a window looking into a dark room, and the woman stands directly against the glass, extremely close to camera. Her figure is huge and fills the entire height of the frame: the top of her head touches the top edge of the frame and her body extends down past the bottom edge. She is a solid jet-black silhouette, a featureless dark shape with only a faint soft grey rim of backlight tracing her outline: long hair, shoulders, a long dress. No face, no eyes, no details, no color. The video begins on an empty, fully black frame. She slowly steps in from the left edge, close to the glass and still filling the full frame height, drifts across, stops in the center facing the viewer as if pressed to the window staring out, sways slightly and tilts her head, then slides out of frame on the right. She re-enters from the right, again full height and close to the glass, then turns and slowly walks back into the darkness of the room, shrinking and fading until she dissolves into the black. The final seconds are an empty, fully black frame, identical to the opening. Slow, eerie, ghostly, unhurried, smooth movement. Minimal, haunting, high contrast, no text, no other people, no camera movement.

**The woman, hand on the glass (12 s)**

> Static locked-off camera, vertical frame, pure black background, no environment, no floor, no light sources. The camera is right at a window looking into a dark room. The video begins on an empty, fully black frame. A woman slowly emerges out of the darkness and stops directly against the glass, extremely close to camera, her figure huge and filling the entire height of the frame: the top of her head touches the top edge of the frame and her body extends past the bottom edge. She is a solid jet-black silhouette, a featureless dark shape with only a faint soft grey rim of backlight tracing her outline: long tangled hair, shoulders, a long dress. No face, no eyes, no details, no color. She stands perfectly, unnaturally still. Then her head slowly tilts downward, as if she has noticed someone on the street below. She slowly raises one hand and presses her palm flat against the glass, fingers spread, the hand silhouette large in the frame. She holds there, motionless. Suddenly her head snaps sharply to one side with a jerky, unnatural movement. Then she slowly sinks backward into the darkness and dissolves completely into the black. The final second is an empty, fully black frame. Eerie, unsettling, horror, high contrast, no text, no other people, no camera movement.

**Neon monster (20 s)**

> Static locked-off camera, vertical frame, pure black background, no environment, no floor, no light sources. The camera is right at a window looking into a pitch-dark room. The video begins on an empty, fully black frame. A tall, gaunt, terrifying monster slowly steps in from the left edge, directly against the glass, extremely close to camera. It is huge and fills the entire height of the frame: the top of its head touches the top edge of the frame and its body extends down past the bottom edge. The monster is vividly colorful against the blackness: slick iridescent skin shifting from toxic green to deep violet and magenta, glowing bioluminescent orange stripes and spots pulsing along its ribs and long arms, a crest of jagged cyan spines down its back, a wide mouth of crooked needle teeth, and two large glowing yellow eyes. Long spindly fingers with hooked claws. It is lit only by its own glow and a faint colored rim light, everything around it pitch black. It moves slowly and unnaturally, with jerky, twitching steps. It drifts across, stops in the center facing the viewer as if staring out the window, cocks its head, slowly breathes, then slides out of frame on the right. It re-enters from the right, close to the glass and still filling the full frame height, then turns and slowly retreats backward into the darkness of the room, shrinking as its glow dims until it dissolves completely into the black. The final seconds are an empty, fully black frame, identical to the opening. Eerie, menacing, horror, high contrast, saturated neon colors on pure black, no text, no other creatures or people, no camera movement.

## Set it up

### What you need

- A TV or monitor that can stand upright (this one is 1080 × 1920).
- A Mac connected to it over HDMI.
- A sheer white or grey curtain for the window.

### The Mac

In Terminal (not as an administrator; no `sudo`):

```sh
git clone https://github.com/ndipatri/HalloweenWindowDisplay.git ~/HalloweenWindowDisplay
cd ~/HalloweenWindowDisplay
bash scheduler/install.sh
```

That installs it, copies the videos over, and starts it. From then on it starts by itself whenever the Mac logs in. Keep the folder where it is: not in Desktop, Documents or Downloads, which macOS keeps it from reading.

Then, in System Settings:

| Setting | Where | Why |
|---|---|---|
| Rotate the display to portrait | Displays → Rotation | It only plays on a display that's taller than it is wide |
| Automatic login | Users & Groups | It only runs while someone's logged in |
| Do Not Disturb on a schedule | Focus → Do Not Disturb | Keeps notifications from popping up over the videos |
| Don't install macOS updates automatically | General → Software Update | An overnight restart can leave the Mac stuck at a login screen |

To try it straight away: `~/video-scheduler/show kid 5` plays the kid videos for five minutes.

### The window

- **Hang the sheer curtain between the glass and the TV.** It hides the screen's edges and turns her into a blurry shape behind fabric. This helps more than anything else.
- **Turn every light in the room off** so nothing gives away that it's a screen.
- **Turn the TV's brightness down** until she's only just visible from the street. A dim figure reads as real; a bright one reads as a TV.
- **Turn off the TV's auto power-off.** Many TVs switch off after about 4 hours without a remote button press. Look for "Auto Power Off", "Eco" or "4-hour off" in the TV's settings.
- Check it from the street after dark and adjust.

## Using it

### Play something else for a while

The `show` command overrides the schedule:

```sh
show                  # what's on screen now, and why
show grownup 30       # the grownup videos for 30 minutes, then back to normal
show kid              # the kid videos until the schedule next changes
show thanksgiving 10  # a season's videos for 10 minutes, even on other days
show off              # black until the schedule next changes
show schedule         # back to the schedule now
```

Overrides end by themselves, so a forgotten one can't leave the scary videos on in the morning. To type just `show` instead of `~/video-scheduler/show`, run this once and open a new Terminal window:

```sh
echo "alias show='$HOME/video-scheduler/show'" >> ~/.zshrc
```

### Everyday tasks

| To | Do this on the Mac |
|---|---|
| See what's on screen | `show` |
| Get new videos from the repo now | `~/video-scheduler/sync` (it also happens at every login) |
| Get the latest version after a change to the dates or times | `cd ~/HalloweenWindowDisplay && git pull && bash scheduler/install.sh` |
| Stop it for tonight | Click the screen and press Control-C. It starts again at the next login |
| See what it's been doing | `cat ~/video-scheduler/scheduler.log` |

Videos removed from the repo aren't deleted from the Mac; they're moved to `~/video-scheduler/.removed/`.

## If something's wrong

Run `show` first: it says what should be on screen and why.

| Problem | Try |
|---|---|
| The wrong season is playing | The Mac has an old version: `cd ~/HalloweenWindowDisplay && git pull && bash scheduler/install.sh` |
| It says `no season today` | Nothing is scheduled for today, so black is expected |
| It's not following the schedule | An override is on: `show schedule` |
| A new video doesn't play | `~/video-scheduler/sync` |
| `show` says `No status yet` | It isn't running: `bash scheduler/install.sh` |
| The Mac desktop shows instead of the videos | Rotate the display to portrait, then `bash scheduler/install.sh` |
| The screen is black but `show` says something is playing | Check the TV's input and brightness, and that the curtain isn't too thick |
| The TV turns itself off in the evening | Turn off the TV's auto power-off |

For anything else, the log has the details: `cat ~/video-scheduler/scheduler.log`.
