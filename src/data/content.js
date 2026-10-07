// Player-facing content. Data-driven; numbers live in config/balance.js.
// Verse wording is ESV, kept brief. Swap VERSE_TRANSLATION / text fields to change translation.

export const VERSE_TRANSLATION = 'ESV';

export const SCRIPTURES = {
  romans1_20: {
    ref: 'Romans 1:20',
    name: 'Creation Bears Witness',
    text: 'His invisible attributes… have been clearly perceived, ever since the creation of the world, in the things that have been made.',
    short: 'God · evidence',
    useful: 'Useful when addressing knowledge of God and objections concerning evidence for God’s existence.',
  },
  proverbs30_5: {
    ref: 'Proverbs 30:5–6',
    name: 'Every Word Proves True',
    text: 'Every word of God proves true; he is a shield to those who take refuge in him. Do not add to his words.',
    short: 'Authority of the Word',
    useful: 'Useful when addressing the authority and purity of God’s Word.',
  },
  john14_6: {
    ref: 'John 14:6',
    name: 'No Other Way',
    text: '“I am the way, and the truth, and the life. No one comes to the Father except through me.”',
    short: 'Christ alone',
    useful: 'Useful when addressing religious pluralism and the exclusivity of Christ.',
  },
  romans3_23: {
    ref: 'Romans 3:23–24',
    name: 'Grace for the Guilty',
    text: 'All have sinned and fall short of the glory of God, and are justified by his grace as a gift, through the redemption that is in Christ Jesus.',
    short: 'Sin · guilt · grace',
    useful: 'Useful when addressing sin, guilt, and the free gift of righteousness in Christ.',
  },
  acts17_30: {
    ref: 'Acts 17:30–31',
    name: 'God Commands Repentance',
    text: 'God… commands all people everywhere to repent, because he has fixed a day on which he will judge the world in righteousness by a man whom he has appointed.',
    short: 'Repentance · assurance',
    useful: 'Useful when addressing self-righteousness, false assurance, and the call to repent.',
  },
  first_cor3_6: {
    ref: '1 Corinthians 3:6–7',
    name: 'God Gives the Growth',
    text: 'I planted, Apollos watered, but God gave the growth. So neither he who plants nor he who waters is anything, but only God who gives the growth.',
    short: 'Planting · watering',
    useful: 'A reminder for every witness: we plant and water, and God gives the growth.',
  },
};

// Labels for a line that is a human moment rather than a quoted passage (listening, your own story).
export const PLAIN_LABELS = {
  direct: 'JUST WHAT WAS NEEDED',
  contextual: 'HEARD WELL',
  relevant: 'HONEST AND HUMAN',
  proclaimed: 'KINDLY SAID',
};

export const SCRIPTURE_ORDER = ['romans1_20', 'proverbs30_5', 'john14_6', 'romans3_23', 'acts17_30', 'first_cor3_6'];

export const MINISTRIES = {
  tracts: { name: 'Tracts', blurb: 'Gospel tracts left in hands and on benches.', icon: 'tract' },
  bibles: { name: 'Bibles', blurb: 'Free Bibles for anyone who will read them.', icon: 'bible' },
  streetTeam: { name: 'Street Team', blurb: 'Friends who stand with you and start conversations.', icon: 'team' },
  bibleStudy: { name: 'Bible Study', blurb: 'People gather to open the Scriptures together.', icon: 'study' },
  discipleship: { name: 'Discipleship', blurb: 'Faithful men and women teaching others also.', icon: 'disciple' },
};
export const MINISTRY_ORDER = ['tracts', 'bibles', 'streetTeam', 'bibleStudy', 'discipleship'];

export const UPGRADE_TEXT = {
  openHands: { name: 'Open Hands', desc: 'Proclaiming the Word charges 30% faster, as you work the street and while you wait.' },
  handsOnTeam: { name: 'Hands-On Team', desc: 'Your Street Team grows stronger with every Tract in circulation (+0.8% each).' },
  streetPreacher: { name: 'Street Preacher', desc: 'Proclaiming the Word carries further across a full street (+8% per person) and charges 20% faster, and every moment pays +10% more.' },
  faithfulRoutine: { name: 'Faithful Routine', desc: 'All passive ministry +35%.' },
  studyLibrary: { name: 'Study Library', desc: 'Every Bible you own strengthens Bible Study (+1% each).' },
  hospitality: { name: 'Hospitality', desc: 'Conversations pay 75% more, and people who want to talk linger +1.5 sec.' },
  multiplication: { name: 'Multiplication', desc: 'All passive ministry +20%, assigned disciples add +40% more, and ministries cost 5% less.' },
  mentorship: { name: 'Mentorship', desc: 'Discipleship grows with every Bible Study group you hold (+2% each).' },
  deepRoots: { name: 'Deep Roots', desc: 'The crowd listens 4 sec longer between the Professor’s arguments and gives a bigger head start (+10%).' },
  broadReach: { name: 'Broad Reach', desc: 'Gatherings are 3 people bigger and stay 3 sec longer; proclaiming the Word carries further (+4% per person).' },
  ironSharpens: { name: 'Iron Sharpens Iron', desc: 'Proclaiming the Word charges 25% faster.' },
  fullBarns: { name: 'Full Barns', desc: 'All passive ministry +25%.' },
  rainGear: { name: 'Rain Gear', desc: 'People stay open to a moment 1 sec longer. (Provisions)' },
  foldingTables: { name: 'Folding Tables', desc: 'Gatherings bring 2 more people. (Provisions)' },
  clearVoice: { name: 'Clear Voice', desc: 'Your words carry +30% more weight in a public exchange, and your helpers carry more of it. (The Professor)' },
  persistence: { name: 'Persistence', desc: '+10% Seeds from street moments, proclaiming the Word and conversations.' },
  courage: { name: 'Courage', desc: '+8% critical proclamation chance and +5% Seeds from every moment.' },
  conviction: { name: 'Conviction', desc: 'Critical proclamations carry +1.0× more weight (triple instead of double).' },
  endurance: { name: 'Endurance', desc: 'Your Active Witness streak holds 1.5 sec longer, and a held streak pays +0.25× more.' },
  readyAnswer: { name: 'Ready Answer', desc: 'Press your point 15% sooner in a public exchange. (The Professor)' },
  swordOfTheSpirit: { name: 'Sword of the Spirit', desc: '+45% Seeds when you proclaim the Word, and more weight for Scripture in exchanges.' },
  watchfulEye: { name: 'Watchful Eye', desc: 'People who want to talk stay in view +4 sec, and open moments last +0.5 sec longer.' },
  preparedMind: { name: 'Prepared Mind', desc: '+20% weight when a passage applies directly or closely to the objection. (The Professor)' },
  everyThought: { name: 'Every Thought', desc: 'A fitting response in a public exchange steadies you: +25% impact for a time. (The Professor)' },
  faithfulHands: { name: 'Faithful Hands', desc: 'All passive ministry +15%.' },
  trainOthers: { name: 'Train Others', desc: 'Ministries with an assigned disciple +30%.' },
  goodStewardship: { name: 'Good Stewardship', desc: 'All ministry purchases cost 15% less.' },
  openDoor: { name: 'Open Door', desc: 'More people are open to a moment, and those who want to talk come sooner (+15%).' },
  entrustToFaithfulMen: { name: 'Entrust to Faithful Men', desc: 'Discipleship production +50%.' },
  literatureBundle: { name: 'Printed Literature Bundle', desc: 'Tracts +50%. (Provisions)' },
  betterBibleSupply: { name: 'Better Bible Supply', desc: 'Bibles +50%. (Provisions)' },
  portableMicrophone: { name: 'Portable Microphone', desc: 'More people hear you: street moments and people who want to talk come 10% more often. (Provisions)' },
  transportation: { name: 'Transportation', desc: 'Street Team +50%. (Provisions)' },
  meetingSpace: { name: 'Meeting-Space Support', desc: 'Bible Study and Discipleship +25%. (Provisions)' },
};

export const UPGRADE_TAG_LABEL = { active: 'Boldness', scripture: 'Watchfulness', ministry: 'Multiplication', supplies: 'Supplies', professor: 'The Professor' };

export const PRESTIGE_TEXT = {
  steadfastWitness: { name: 'Steadfast Witness', desc: '+10% permanent weight in public exchanges.' },
  rootedInTheWord: { name: 'Rooted in the Word', desc: '+15% Word strength; passages that apply well carry +10% more weight.' },
  establishedLabor: { name: 'Established Labor', desc: '+10% permanent passive ministry.' },
  willingHands: { name: 'Willing Hands', desc: 'Assigned disciples add +20% more to their ministry.' },
  faithfulInheritance: { name: 'Faithful Inheritance', desc: 'Begin each generation with 1,000 Seeds, 5 Tracts and 2 Bibles.' },
  passedOnWisdom: { name: 'Passed-On Wisdom', desc: 'First upgrade cluster is ready from the start; offline gains +10%.' },
};
export const PRESTIGE_BRANCHES = {
  word: { name: 'The Word', blurb: 'Active witness & Scripture' },
  work: { name: 'WORK', blurb: 'Ministry & disciples' },
  generations: { name: 'GENERATIONS', blurb: 'Legacy & inheritance' },
};

// Special encounters: three recognizable kinds of conversation. Each person has a distinct core issue, a short
// objection, and three plausible ways a Christian might respond. A response is graded for how well it answers the
// actual issue (grade: strong | partial | weak). No response is mocked, and none decides anyone's heart.
//
// After your response, each situation has three things you can say next (`next`), written for what that person raised:
// direct (draws on Scripture and answers it), relevant (honest and human), proclaimed (a true passage not aimed at the question).
export const ENCOUNTERS = {
  skeptic: {
    name: 'The Skeptic',
    issue: 'Knowledge of God',
    look: { skin: '#e4bd96', hair: '#1f1f2c', top: '#4d5668', bottom: '#2a2f3a', accessory: 'phone', hairStyle: 'messy', kit: 'skeptic' },
    funds: 1.0,
    askScripture: 'He raises an eyebrow, phone still in hand. What do you say next?',
    returns: { good: 'You again. I kept replaying your question between podcasts.', poor: 'You again. Please tell me this beats the comment-section version.' },
    variants: [
      {
        statement: 'You believe in God, but what actual evidence is there that He exists? I watched a twelve-minute video that said there basically isn’t any.',
        choices: [
          {
            id: 'standard', grade: 'strong', label: 'FOUNDATION EXPOSED',
            text: 'What standard are you using to decide what counts as evidence?',
            feedback: 'Every demand for evidence rests on assumptions about logic, truth and reason. Asking about them gently shows the question is not neutral.',
            reply: 'Logic, observation, the usual adult table settings. He pockets his phone. Why wouldn’t those count?',
          },
          {
            id: 'arguments', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'There are scientific and philosophical arguments for God we could look at together.',
            feedback: 'Charitable and not untrue, but it treats his reasoning as a neutral judge over God. The question underneath is left standing.',
            reply: 'I’ve heard the greatest-hits version. It still feels slippery.',
          },
          {
            id: 'faith', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'Ultimately, God is something you just have to believe by faith.',
            feedback: 'Faith matters, but this sounds as if belief in God has no ground. Scripture says creation itself testifies to Him.',
            reply: 'So faith means “no evidence with better branding”?',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans1_20', say: 'Honestly? Everything—the order, the beauty, even your ability to reason. Scripture says creation shows us who God is.', reply: 'That’s a big claim. Still, I can’t say I’ve ever accounted for reason itself.' },
          { id: 'b', grade: 'relevant', say: 'I can’t put God under a lab lamp. But I can tell you why I’m convinced, if you’ll give me sixty sidewalk seconds.', reply: 'Sixty seconds is efficient. Fine, go ahead.' },
          { id: 'c', grade: 'proclaimed', verse: 'proverbs30_5', say: 'Scripture says every word of God proves true; He is a shield to those who take refuge in Him.', reply: 'That’s a clean line. It still dodges my evidence question.' },
        ],
      },
      {
        statement: 'I’m a scientist. If I can’t test it, I don’t believe it. My lab doesn’t accept vibes. Can you test God?',
        choices: [
          {
            id: 'selftest', grade: 'strong', label: 'FOUNDATION EXPOSED',
            text: 'Did you test the idea that only testable things are true? How do you know that one?',
            feedback: 'The rule cannot pass its own test. Showing that gently reveals a belief held by faith, not neutral evidence.',
            reply: 'That is annoyingly fair. I’d have to think about how I justify that rule.',
          },
          {
            id: 'scientists', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Plenty of great scientists have believed in God, and science can’t test everything.',
            feedback: 'True and polite, but it leans on other people’s opinions rather than the foundation of the claim.',
            reply: 'Sure, some do. Credentials still aren’t an argument.',
          },
          {
            id: 'separate', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'Maybe science and faith are just two different worlds that never touch.',
            feedback: 'It keeps the peace by giving up the claim that God made and rules the very world science studies.',
            reply: 'Great. Then keep faith over there and I’ll keep microscopes over here.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans1_20', say: 'Science studies a world that stays ordered and knowable. Scripture says that very world shows who made it.', reply: 'Ordered and knowable… I’ve treated that like free background music.' },
          { id: 'b', grade: 'relevant', say: 'I won’t fake a lab result on God. I’d just like to tell you why I trust Him anyway.', reply: 'That I can respect, even if I remain suspicious.' },
          { id: 'c', grade: 'proclaimed', verse: 'john14_6', say: 'Jesus said, “I am the way, and the truth, and the life”—not just one useful voice among many.', reply: 'Quoting Jesus to a sidewalk scientist is confident, I’ll give you that.' },
        ],
      },
      {
        after: 420, // a newer kind of conversation: appears later in the generation
        statement: 'Science explains how the universe works. Why bolt “God” onto it like some cosmic spare part?',
        choices: [
          {
            id: 'orderly', grade: 'strong', label: 'FOUNDATION EXPOSED',
            text: 'Does science explain why the universe is orderly and understandable in the first place?',
            feedback: 'Science assumes an orderly, knowable world. Asking where that order comes from shows the question needs more than science to answer.',
            reply: 'It just is that way. That’s why grants get funded. He smirks, then shrugs.',
          },
          {
            id: 'designer', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Many people see God as the designer behind the laws science describes.',
            feedback: 'True, and gently put, but it offers a conclusion without showing why his own starting point cannot account for order.',
            reply: 'People say that. I still don’t see why I need the extra layer.',
          },
          {
            id: 'sundays', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'Fair enough. Maybe we can leave God out of the lab and keep Him for Sundays.',
            feedback: 'It keeps the peace by conceding that God has nothing to do with the world science studies, which is the very thing Scripture denies.',
            reply: 'Exactly. Keep God for songs and funerals and we’re all good.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans1_20', say: 'Science describes how the world works. It cannot explain why there is order to describe. Scripture says creation points to its Maker.', reply: 'Why there is order at all… that lands a little harder than I expected.' },
          { id: 'b', grade: 'relevant', say: 'I love that science works. I just wonder why the universe is understandable, and why our minds fit it at all.', reply: 'That’s at least a more interesting version of the question.' },
          { id: 'c', grade: 'proclaimed', verse: 'acts17_30', say: 'Scripture says God commands all people everywhere to repent.', reply: 'Repent for studying physics? That leap lost me.' },
        ],
      },
      {
        after: 840, // a newer kind of conversation: appears later in the generation
        statement: 'If God exists, why is there so much suffering? That feels like better evidence against Him than for Him.',
        choices: [
          {
            id: 'standard', grade: 'strong', label: 'FOUNDATION EXPOSED',
            text: 'That matters to you, and it should. When you call suffering wrong, what standard of right and wrong are you appealing to?',
            feedback: 'It takes the pain seriously and kindly asks what the objection assumes: a real standard of good that needs a ground.',
            reply: 'I know I’m not being objective here. It just feels wrong all the way down. He looks away.',
          },
          {
            id: 'reasons', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'God may have reasons we can’t see, and suffering can sometimes lead to growth.',
            feedback: 'Sometimes true, but offered to someone in an objection it can sound dismissive, and it leaves the standard behind the question untouched.',
            reply: 'That answer always feels preprinted, just on nicer paper.',
          },
          {
            id: 'distant', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'Maybe God just isn’t very involved in the world.',
            feedback: 'It concedes the objection by giving up what Scripture says about God’s rule and nearness.',
            reply: 'If He’s distant, I honestly don’t know why anyone bothers.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans3_23', say: 'I’m sorry—suffering is real. Scripture does not airbrush it. It says sin has broken the world, and Christ stepped into that pain and bore it.', reply: 'Christ stepping into it… that’s not the answer I expected. Keep going.' },
          { id: 'b', grade: 'relevant', say: 'That’s not a debate-club question. What’s behind it for you?', reply: '…My brother. Last year. I don’t usually say that out loud.' },
          { id: 'c', grade: 'proclaimed', verse: 'first_cor3_6', say: 'There’s a verse that steadies me here: I planted, Apollos watered, but God gave the growth.', reply: 'Growth? We are talking about pain, not produce.' },
        ],
      },
    ],
    reactions: {
      low: ['He gives a small shrug and walks on, unconvinced.', 'He checks his phone, mutters “interesting,” and drifts away.'],
      mid: ['He pauses a moment, then nods. “I’ll think about it.”', 'He takes a tract with the caution of someone downloading a dubious PDF.'],
      high: ['He lingers. “Can I ask you something else without turning this into a thread?”', 'He looks away, thoughtful. “Nobody has put it that way before.”'],
    },
  },
  nominal: {
    name: 'The Nominal Christian',
    issue: 'False assurance',
    look: { skin: '#b98660', hair: '#6a472f', top: '#c7a083', bottom: '#46536a', accessory: 'coffee', hairStyle: 'long', kit: 'nominal' },
    funds: 1.0,
    askScripture: 'They notice the Bible in your hand and smile like they know the chorus. What do you say next?',
    returns: { good: 'I kept thinking about what you said, which was rude of you in a helpful way.', poor: 'Back again? God and I still have an understanding, thanks.' },
    variants: [
      {
        statement: 'I believe in God. I’m a pretty good person. I even have the bumper sticker. I’m sure I’ll be fine.',
        choices: [
          {
            id: 'standard', grade: 'strong', label: 'BIBLICALLY GROUNDED',
            text: 'Good compared to whom? What does God say His standard is?',
            feedback: 'He sets the measure, not us. Naming His holy standard turns attention from a comparison with others to the need for a Savior.',
            reply: 'I mostly compare myself to people who cut in line, so that may not be a great standard.',
          },
          {
            id: 'afterlife', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'It’s good that you believe in God. Do you ever think about what comes after this life?',
            feedback: 'A warm opening, but it leaves the assumption of being a good person untouched, so the real issue stays hidden.',
            reply: 'Sometimes. I figure it all evens out in the end.',
          },
          {
            id: 'affirm', grade: 'weak', label: 'ASSURANCE LEFT STANDING',
            text: 'I’m glad. God loves good people, and I’m sure He is pleased with you.',
            feedback: 'Kind, but it confirms a hope built on personal goodness. Scripture says there is none righteous, and that hope would not hold.',
            reply: 'Right? That’s more or less been my working theory.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'acts17_30', say: 'God’s standard is not “better than most.” He commands everyone to repent, because He will judge the world in righteousness.', reply: 'Judge… I honestly thought being decent was the whole assignment.' },
          { id: 'b', grade: 'relevant', say: 'I used to grade on a curve too, until I saw how holy God is. That changed the whole math for me.', reply: 'You graded on a curve? Okay, that one landed. Go on.' },
          { id: 'c', grade: 'proclaimed', verse: 'proverbs30_5', say: 'Every word of God proves true. Do not add to His words.', reply: 'All right, but that still sounds like a verse for other people.' },
        ],
      },
      {
        statement: 'I was baptized, and I do Christmas and Easter pretty faithfully. God knows my heart.',
        choices: [
          {
            id: 'heart', grade: 'strong', label: 'BIBLICALLY GROUNDED',
            text: 'He does know it. What does He say is in the human heart, and what does He require of us?',
            feedback: 'Taking their words seriously, you turn to what God says: sin, repentance and faith in Christ, not a ritual or a label.',
            reply: 'I always assumed “good heart” was basically the receipt.',
          },
          {
            id: 'invite', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Church is a good thing. Maybe you would like to come along to ours sometime?',
            feedback: 'Kind, but it speaks to activity, not the gospel. A person can attend and still trust in themselves.',
            reply: 'Maybe. I’m not against church; I’m just not chasing perfect attendance.',
          },
          {
            id: 'leave', grade: 'weak', label: 'ASSURANCE LEFT STANDING',
            text: 'You’re right, only God can judge a person’s heart. I’ll leave it between you and Him.',
            feedback: 'Humble-sounding, but it avoids what God has already said about the heart and about how sinners are made right.',
            reply: 'Exactly. He can sort it out without both of us making it awkward.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans3_23', say: 'Baptism and church are good, but they cannot save us. We have all sinned, and we are made right by grace through Christ.', reply: 'By grace, not by being baptized? I’d have to rethink a few family assumptions.' },
          { id: 'b', grade: 'relevant', say: 'What do you think changes when someone actually trusts Christ, instead of just growing up near Christian things?', reply: 'Honestly, I never stopped to ask whether those were different.' },
          { id: 'c', grade: 'proclaimed', verse: 'romans1_20', say: 'God’s eternal power and divine nature are clearly seen in the things He made.', reply: 'Sure, I can say that part. I’m still asking where that leaves me.' },
        ],
      },
      {
        after: 420, // a newer kind of conversation: appears later in the generation
        statement: 'I’m spiritual, not religious. I pray sometimes. God and I have an understanding, and He knows I’m trying.',
        choices: [
          {
            id: 'whom', grade: 'strong', label: 'BIBLICALLY GROUNDED',
            text: 'Who are you praying to? And what has He said about how sinners come to Him?',
            feedback: 'It takes their prayer seriously and turns to who God is and what He has said, rather than a private sense of spirituality.',
            reply: 'Honestly, I’ve never nailed down who. I just sort of send the prayer upward.',
          },
          {
            id: 'keepgoing', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Prayer is wonderful. Keep it up, and maybe you will find a church you like.',
            feedback: 'Encouraging, but it affirms the sense of being fine and never reaches repentance and faith in Christ.',
            reply: 'Maybe someday. Right now I’m doing the home version.',
          },
          {
            id: 'ownway', grade: 'weak', label: 'ASSURANCE LEFT STANDING',
            text: 'That’s great. Everyone finds God in their own way.',
            feedback: 'Warm, but it replaces what God has said with personal preference, and Christ said He is the only way.',
            reply: 'Exactly. Everybody has their own lane.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'john14_6', say: 'Jesus said, “I am the way, and the truth, and the life. No one comes to the Father except through me.” He is not one option among many.', reply: 'That is pretty exclusive. I can’t just file that under “whatever works,” can I?' },
          { id: 'b', grade: 'relevant', say: 'I’m glad you pray. When you picture God listening, who do you think He is?', reply: 'That is embarrassingly specific, and I’m not sure I have an answer.' },
          { id: 'c', grade: 'proclaimed', verse: 'romans1_20', say: 'God’s power and nature are clear in the world He made.', reply: 'Right, and that’s why I feel spiritual already. So are we agreeing or not?' },
        ],
      },
      {
        after: 840, // a newer kind of conversation: appears later in the generation
        statement: 'My family has always been Christian. I still have a WWJD bracelet in a drawer somewhere, so I’m good.',
        choices: [
          {
            id: 'personal', grade: 'strong', label: 'BIBLICALLY GROUNDED',
            text: 'That’s a real blessing. But each of us answers to God and must trust Christ for ourselves. Have you?',
            feedback: 'It honors their heritage while pointing to personal repentance and faith, which no family or upbringing can supply.',
            reply: 'I really have treated it like family membership instead of something personal.',
          },
          {
            id: 'churchlately', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Then you know more than most. Have you been to church lately?',
            feedback: 'Friendly, but it asks about attendance rather than whether they trust Christ.',
            reply: 'Not lately. Sundays and I keep missing each other.',
          },
          {
            id: 'heritage', grade: 'weak', label: 'ASSURANCE LEFT STANDING',
            text: 'Then you’re in great shape. Your heritage speaks for itself.',
            feedback: 'It confirms a hope resting on family and upbringing, though salvation is by grace through faith in Christ.',
            reply: 'Exactly. Heritage has to count for something.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'acts17_30', say: 'God commands every person everywhere to repent. No one inherits faith from family any more than eye color gets you into heaven.', reply: 'Everyone? Even people with church cookout memories and Sunday-school stickers? Hm.' },
          { id: 'b', grade: 'relevant', say: 'Church can surround you for years and still feel borrowed. That happened to me until I trusted Christ myself.', reply: 'Borrowed faith… that phrase is sticking to me.' },
          { id: 'c', grade: 'proclaimed', verse: 'proverbs30_5', say: 'Every word of God proves true; He is a shield to those who take refuge in Him, not in family history.', reply: 'I know the verse. I’m not sure I’ve ever actually taken refuge in Him.' },
        ],
      },
    ],
    reactions: {
      low: ['They nod politely and keep walking, still comfortable in themselves.', 'They smile, thank you, and tuck the moment beside old church memories.'],
      mid: ['They pause. “I’ll think about that.”', 'They take a tract and slip it into the same pocket as a receipts avalanche.'],
      high: ['They stay quiet a moment. “I’m not sure I’ve been as sure as I sounded.”', 'They ask, “What would repenting even look like, exactly?”'],
    },
  },
  broken: {
    name: 'The Broken Sinner',
    issue: 'Guilt and hopelessness',
    look: { skin: '#c9987a', hair: '#2a2420', top: '#7a644f', bottom: '#2e2e38', accessory: 'beanie', hairStyle: 'short', kit: 'broken' },
    funds: 1.2,
    askScripture: 'They keep their eyes on the pavement, waiting to see if you’ll be gentle. What do you say next?',
    returns: { good: 'I kept hearing what you said after I left.', poor: 'I’m still not sure any of this could be for me.' },
    variants: [
      {
        statement: 'You don’t know what I’ve done. I’ve made a wreck of too much already. God wouldn’t want someone like me.',
        choices: [
          {
            id: 'christ', grade: 'strong', label: 'GRACE AND TRUTH',
            text: 'Sin is serious, and that is why Christ died for sinners. His blood is enough for what you’ve done. Repent and trust Him.',
            feedback: 'Neither shrinking the sin nor doubting the cross. Sin is real and Christ’s sacrifice is sufficient: the gospel for the guilty.',
            reply: 'You really think it could cover all of it? They give a tired half-laugh. “That would be new.”',
          },
          {
            id: 'soften', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Don’t be so hard on yourself. Everybody makes mistakes, and God understands.',
            feedback: 'Kind, but it shrinks what sin is. Comfort that ignores guilt cannot reach someone who knows they are guilty.',
            reply: 'You say “mistakes” like you’re being kind. It doesn’t feel that small.',
          },
          {
            id: 'earn', grade: 'weak', label: 'GRACE OBSCURED',
            text: 'Then you’ll need to turn your life around and show God you’re sorry before He accepts you.',
            feedback: 'It takes sin seriously but hides grace. Forgiveness is a gift received by repentance and faith in Christ, not a payment we make.',
            reply: 'Then I can never untangle it enough, can I?',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans3_23', say: 'We have all sinned and fall short, you and me both. But we are made right freely, by grace, through Christ’s redemption.', reply: 'Freely? A gift? I’ve spent years trying to pay something back.' },
          { id: 'b', grade: 'relevant', say: 'I’m not going to rush you or tidy this up with a slogan. I’m listening.', reply: 'Thank you. People usually either flinch or preach past me.' },
          { id: 'c', grade: 'proclaimed', verse: 'acts17_30', say: 'God commands all people everywhere to repent, because He has fixed a day of judgment.', reply: 'Judgment is already the loud part in my head.' },
        ],
      },
      {
        statement: 'I keep failing. I’ve asked for forgiveness a hundred times. At this point I feel like a rerun nobody asked for.',
        choices: [
          {
            id: 'finished', grade: 'strong', label: 'GRACE AND TRUTH',
            text: 'Christ’s sacrifice was once for all, and He said He will never cast out anyone who comes. Repent and trust Him, not your record.',
            feedback: 'It points from the person’s record to the finished work of Christ, while still calling for repentance and faith.',
            reply: 'Not my record… I’ve been weighing the wrong ledger.',
          },
          {
            id: 'harder', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'God is patient with us. Try a little harder, and keep going to church.',
            feedback: 'Patience is true, but pointing back to effort leaves the person leaning on themselves.',
            reply: 'I’ve tried harder so many times. That is part of why I’m tired.',
          },
          {
            id: 'sorry', grade: 'weak', label: 'GRACE OBSCURED',
            text: 'If you were really sorry, you would have changed by now.',
            feedback: 'It adds weight without a Savior. Repentance is real, but it is not the ground of forgiveness. Christ is.',
            reply: 'Then maybe I really am too far gone.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans3_23', say: 'Christ does not cast out the one who comes. No one is too far gone for His grace, because forgiveness rests on Him, not your record.', reply: 'Not being cast out… I keep forgetting that part and remembering everything else.' },
          { id: 'b', grade: 'relevant', say: 'I know the feeling of replaying the same failure. Tell me where you feel most stuck.', reply: 'It helps just hearing someone say that without sounding shocked.' },
          { id: 'c', grade: 'proclaimed', verse: 'first_cor3_6', say: 'Scripture says, “I planted, Apollos watered, but God gave the growth.”', reply: 'I know the farming line. I’m talking about the wreckage, not a garden.' },
        ],
      },
      {
        after: 420, // a newer kind of conversation: appears later in the generation
        statement: 'I’ve hurt people I love. I can’t forgive myself, and I don’t know how to face them.',
        choices: [
          {
            id: 'bornit', grade: 'strong', label: 'GRACE AND TRUTH',
            text: 'What you did was sin against them and against God, and Christ bore that guilt. In Him there is forgiveness, and He leads us to make things right.',
            feedback: 'It names the wrong honestly, points to the cross as sufficient, and does not leave them with only self-forgiveness.',
            reply: 'Christ bore it… I thought it was only mine to drag around.',
          },
          {
            id: 'selffirst', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'You have to forgive yourself first. Then you can move on.',
            feedback: 'Well meant, but it makes the person the source of their own peace instead of pointing to Christ’s forgiveness.',
            reply: 'I’ve tried that speech in the mirror. It lands flat every time.',
          },
          {
            id: 'time', grade: 'weak', label: 'GRACE OBSCURED',
            text: 'Some things you just live with. Time heals most wounds.',
            feedback: 'Time can soften pain but it cannot remove guilt, and it leaves out the One who forgives.',
            reply: 'Time has mostly just made it older.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans3_23', say: 'That wound is real, and God sees it. But Christ bore guilt like this. In Him there is forgiveness, and a way to begin making things right.', reply: 'Forgiveness and repair… I had not let myself hope for both at once.' },
          { id: 'b', grade: 'relevant', say: 'Tell me about them, if you want. We do not have to sprint past the hard part.', reply: 'My kids. I missed so much, and I keep hearing the little things.' },
          { id: 'c', grade: 'proclaimed', verse: 'john14_6', say: 'Even here, Jesus says, “I am the way, and the truth, and the life.”', reply: 'I know that matters. Right now I’m talking about my family.' },
        ],
      },
      {
        after: 840, // a newer kind of conversation: appears later in the generation
        statement: 'Nobody would want me in a church. Look at my past. I’d probably set off some kind of alarm.',
        choices: [
          {
            id: 'sinners', grade: 'strong', label: 'GRACE AND TRUTH',
            text: 'Jesus said He came for sinners, not the righteous. His church is full of forgiven sinners who needed Him as much as you do.',
            feedback: 'It answers the shame with who Christ came for and makes the church a place of the forgiven, not the impressive.',
            reply: 'Forgiven sinners I could maybe sit with. Fancy people in matching smiles, not so much.',
          },
          {
            id: 'friendly', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Churches are full of friendly people. I’m sure you would be welcomed.',
            feedback: 'Kind, but it relies on people’s friendliness and never names Christ as the reason anyone belongs.',
            reply: 'People are friendly right up until the details show up.',
          },
          {
            id: 'cleanup', grade: 'weak', label: 'GRACE OBSCURED',
            text: 'Maybe start by cleaning up your life, and then come.',
            feedback: 'It reverses the gospel: Christ receives sinners as they are and then changes them.',
            reply: 'So I need to get presentable first. That figures.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans3_23', say: 'The church is full of people who have sinned and been forgiven by grace. That is the only qualification any of us bring.', reply: 'Forgiven by grace… I could sit in a room built on that.' },
          { id: 'b', grade: 'relevant', say: 'The first time I walked into church, I felt like I should apologize to the carpet. Someone simply sat beside me.', reply: 'Someone just sat beside you? I think I’d like that more than a speech.' },
          { id: 'c', grade: 'proclaimed', verse: 'romans1_20', say: 'God’s power and nature are clear in the things He made.', reply: 'I came looking for mercy, not scenery.' },
        ],
      },
    ],
    reactions: {
      low: ['They look away and shake their head, not ready to hear it.', 'They wipe their eyes and walk on quietly, holding themselves together.'],
      mid: ['They hold the tract a long moment. “Maybe.”', 'They linger at the edge of the crowd as if leaving is harder than staying.'],
      high: ['They breathe out slowly. “I didn’t know it could be like that.”', 'They ask, “Could you tell me more about Him, slowly?”'],
    },
  },
  worker: {
    name: 'The Exhausted Worker',
    issue: 'Busyness and weariness',
    look: { skin: '#d5a27d', hair: '#3a302c', top: '#5d6f88', bottom: '#4f5861', accessory: 'coffee', hairStyle: 'messy', kit: 'worker' },
    funds: 1.0,
    askScripture: 'They shift a briefcase, glance at a buzzing watch, and still pause. What do you say next?',
    returns: { good: 'You again. I actually replayed that between calendar alerts.', poor: 'You again. Give me the sixty-second version; my phone thinks I’m late already.' },
    variants: [
      {
        statement: 'I’m not against God. I’m just four coffees deep and late to everything. I’ll look into Him when life calms down.',
        choices: [
          {
            id: 'today', grade: 'strong', label: 'BIBLICALLY GROUNDED',
            text: 'What if the issue isn’t finding a calmer season, but answering God now while you have today?',
            feedback: 'It gently exposes delay as a spiritual response, not just a scheduling problem. Busyness cannot postpone God’s call forever.',
            reply: 'Today? They laugh without humor. “My calendar barely believes in lunch.”',
          },
          {
            id: 'later', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Life really is busy. Maybe you can set aside time later to think about spiritual things.',
            feedback: 'Sympathetic, but it accepts delay on the person’s terms instead of showing that God addresses us in the middle of ordinary life.',
            reply: 'That is the plan. It just keeps getting rescheduled.',
          },
          {
            id: 'important', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'I get it. Handle the important stuff first, and circle back to God when work eases up.',
            feedback: 'It surrenders the issue by treating God as optional until the schedule clears, as though work outranks His call.',
            reply: 'Exactly. Finally, a practical person.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'acts17_30', say: 'God is patient, but He calls us now. The gospel is not a tab we keep open until quarter-end.', reply: 'That is annoyingly clear. I use “later” on almost everything that matters.' },
          { id: 'b', grade: 'relevant', say: 'I know the feeling of living by alerts. What do you think all the rushing is buying you?', reply: 'Mostly invoices and a weird loyalty to exhaustion, if I’m honest.' },
          { id: 'c', grade: 'proclaimed', verse: 'first_cor3_6', say: 'Even a short verse says it plainly: I planted, Apollos watered, but God gave the growth.', reply: 'That is nice, but my calendar is still undefeated.' },
        ],
      },
      {
        statement: 'Honestly, faith sounds like one more item on my to-do list, and I’m already failing the list.',
        choices: [
          {
            id: 'gift', grade: 'strong', label: 'GRACE AND TRUTH',
            text: 'If salvation were another task, none of us would finish. What if grace is a gift, not a checkbox?',
            feedback: 'It answers the weariness directly: the gospel is not another performance metric. Grace meets the person where effort has already failed.',
            reply: 'A gift would be a change. Everything else in my life invoices me first.',
          },
          {
            id: 'habit', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Maybe start small—read a verse before work and build a habit.',
            feedback: 'Habits can help, but this still treats faith mainly as better productivity and does not address grace for a person who cannot keep up.',
            reply: 'I can build habits. I am less great at believing they save me.',
          },
          {
            id: 'effort', grade: 'weak', label: 'GRACE OBSCURED',
            text: 'Discipline helps. If you try harder, maybe God will see your effort.',
            feedback: 'It turns salvation into another burden. Scripture says we all fall short and are justified by grace as a gift, not by improved effort.',
            reply: 'So even God gets the “please circle back with revisions” version of me?',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans3_23', say: 'The gospel is not another task to finish. We all fall short, and God justifies by grace as a gift in Christ.', reply: 'Grace as a gift sounds unlike every performance review I have ever had.' },
          { id: 'b', grade: 'relevant', say: 'I know the feeling of staring at a list that multiplies overnight. Why does God feel like one more burden to you?', reply: 'Because every serious thing in my life seems to come with metrics and consequences.' },
          { id: 'c', grade: 'proclaimed', verse: 'acts17_30', say: 'The Bible says God commands all people everywhere to repent.', reply: 'Hearing “repent” sounds like another red exclamation mark on my planner.' },
        ],
      },
      {
        after: 420, // a newer kind of conversation: appears later in the generation
        statement: 'My work is what makes my life count. If I stop moving, I start feeling like I disappear.',
        choices: [
          {
            id: 'worth', grade: 'strong', label: 'FOUNDATION EXPOSED',
            text: 'If your worth rises and falls with output, what happens when your strength runs out?',
            feedback: 'It exposes the foundation under the busyness: identity rooted in productivity. That ground cannot hold when weakness or loss comes.',
            reply: 'That is not a fun question before my fifth coffee.',
          },
          {
            id: 'balance', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Work can be a good gift, but balance matters.',
            feedback: 'True enough, but it stays at lifestyle advice and never reaches the deeper question of what gives a person lasting worth.',
            reply: 'Balance is the poster on the wall right before the inbox avalanche.',
          },
          {
            id: 'productive', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'At least you’re productive. A lot of people aren’t.',
            feedback: 'It flatters the false foundation by treating output as the measure of value, rather than calling it into question.',
            reply: 'See? Someone understands why I answer emails like it’s a sacrament.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'first_cor3_6', say: 'Your work matters, but it cannot make you ultimate. Even our best labor is dependent; God gives the growth and the weight that lasts.', reply: 'Dependent is not my favorite word, but it may be the truest thing you’ve said.' },
          { id: 'b', grade: 'relevant', say: 'You sound tired enough to use accomplishment like oxygen. I have done that too.', reply: 'That is uncomfortably accurate, which is impressive for a sidewalk conversation.' },
          { id: 'c', grade: 'proclaimed', verse: 'proverbs30_5', say: 'Every word of God proves true; He is a shield to those who take refuge in Him, not in output.', reply: 'That sounds solid. I’m just not sure how it touches the time sheet.' },
        ],
      },
      {
        after: 840, // a newer kind of conversation: appears later in the generation
        statement: 'I keep saying I’ll think about eternal things after this quarter, this launch, this inbox… and then it’s another quarter.',
        choices: [
          {
            id: 'trust', grade: 'strong', label: 'BIBLICALLY GROUNDED',
            text: 'What if the busyness is not only your schedule, but what you trust to save you from silence?',
            feedback: 'It moves beneath the packed calendar to the heart. Busyness often becomes refuge, identity, or avoidance, and that must be named gently.',
            reply: 'Silence is exactly when my brain starts yelling, so… maybe.',
          },
          {
            id: 'dayoff', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Maybe take a day off and finally reflect on deeper things.',
            feedback: 'Rest is useful, but the core issue is not solved by a better planner. The person still needs God, not merely margin.',
            reply: 'A day off usually becomes “catching up, but horizontally.”',
          },
          {
            id: 'season', grade: 'weak', label: 'ASSURANCE LEFT STANDING',
            text: 'As long as you mean well, God understands the season you’re in.',
            feedback: 'It leaves delay standing as harmless. Good intentions do not answer God’s present call or address the refuge the person has built in work.',
            reply: 'Good, because this season has lasted roughly seven fiscal years.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'proverbs30_5', say: 'God’s word proves true, and He is a shield to those who take refuge in Him—not in a packed calendar that never saves us.', reply: 'Refuge is not how I would have described my schedule, but it fits more than I like.' },
          { id: 'b', grade: 'relevant', say: 'You sound exhausted, not lazy. What are you afraid will happen if you ever stop long enough to listen?', reply: 'That I’ll notice how thin all of this feels when the notifications shut up.' },
          { id: 'c', grade: 'proclaimed', verse: 'john14_6', say: 'Christ said, “I am the way, and the truth, and the life,” not one more route on your map.', reply: 'I know that matters. I’m just used to hearing “way” and picturing a route with milestones.' },
        ],
      },
    ],
    reactions: {
      low: ['They nod, mouth “sorry, late,” and hurry off.', 'They skim the tract like an email subject line and keep moving.'],
      mid: ['They pause with one hand on the lanyard. “I’ll think about that after this meeting.”', 'They tuck the tract into a briefcase pocket already full of cables and receipts.'],
      high: ['They exhale. “I am more tired than I usually admit.”', 'They stay a moment longer, phone buzzing ignored. “Can you say that part again?”'],
    },
  },
  visitor: {
    name: 'The Visiting Representative',
    issue: 'A different gospel',
    look: { skin: '#d4a17f', hair: '#2a231d', top: '#f2f1eb', bottom: '#2f3542', accessory: 'tote', hairStyle: 'short', kit: 'visitor' },
    funds: 1.0,
    askScripture: 'They offer a laminated brochure with a courteous smile. What do you say next?',
    returns: { good: 'You again. I appreciated that you actually answered me instead of just trading pamphlets.', poor: 'Hello again. Still on the same corner, still with literature, I see.' },
    variants: [
      {
        statement: 'I’m visiting from out of town. We believe God gave a newer book that completes the Bible. May I leave you this brochure?',
        choices: [
          {
            id: 'complete', grade: 'strong', label: 'FOUNDATION EXPOSED',
            text: 'If God’s word is pure and complete, why would we need a later authority added to it?',
            feedback: 'It addresses the root issue: whether God’s word stands complete and supreme, or must be supplemented by another authority.',
            reply: 'That is the question everyone asks. We see it as clarification, not addition. They straighten the brochure.',
          },
          {
            id: 'prefer', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'I appreciate how prepared you are. I personally prefer to stick with the Bible.',
            feedback: 'Courteous, but too personal to challenge the claim itself. Preference is weaker than showing why the added authority is wrong.',
            reply: 'I appreciate the honesty. People usually skip straight to arguing.',
          },
          {
            id: 'useful', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'Sure, if it helps people feel spiritual, maybe it’s all useful.',
            feedback: 'It surrenders the authority question and treats contradictory claims as equally helpful, leaving false teaching unchallenged.',
            reply: 'That is refreshing. We do try to be helpful.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'proverbs30_5', say: 'God says every word of His proves true and warns us not to add to it. A later authority does not complete Him; it challenges Him.', reply: 'You are putting the question exactly where it hurts, which I admit is fair.' },
          { id: 'b', grade: 'relevant', say: 'It is a little funny that we both showed up with literature. But if God has spoken, I need to know why His word would not already be enough.', reply: 'That is fair, and yes, this corner has become a very polite pamphlet duel.' },
          { id: 'c', grade: 'proclaimed', verse: 'john14_6', say: 'Jesus said, “I am the way, and the truth, and the life,” which is why I cannot treat truth like upgraded brochures.', reply: 'I do believe Jesus matters. I am asking how you decide which writings explain Him.' },
        ],
      },
      {
        statement: 'We teach that God welcomes sincere people who obey, serve, and keep growing. Salvation is a path you stay worthy of.',
        choices: [
          {
            id: 'enough', grade: 'strong', label: 'GRACE AND TRUTH',
            text: 'If salvation is earned by effort, how much effort is enough for a sinner who already falls short?',
            feedback: 'It presses the fatal weakness in an earned-salvation system: sinners do not need a taller ladder, but grace they cannot generate.',
            reply: 'We would say devotion, obedience, perseverance. They pause. “Enough” is a hard word, though.',
          },
          {
            id: 'goodworks', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Good works matter, but God also loves us.',
            feedback: 'Warm, but it leaves works and grace muddled together. The person still needs to hear that justification is a gift in Christ.',
            reply: 'Yes, love and effort together—that is closer to how I would put it.',
          },
          {
            id: 'prove', grade: 'weak', label: 'GRACE OBSCURED',
            text: 'That sounds reasonable. People should have to prove they mean it.',
            feedback: 'It obscures grace entirely by agreeing that acceptance before God must be earned through performance.',
            reply: 'Exactly. Commitment should cost something.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'romans3_23', say: 'All have sinned and fall short, and justification is by grace as a gift in Christ—not wages for improved behavior.', reply: 'Gift instead of wages… that is a very different way of speaking about salvation.' },
          { id: 'b', grade: 'relevant', say: 'You are earnest, and I respect that. Can I ask whether you ever feel you have done enough?', reply: 'If I am candid, “enough” is not a word I feel comfortable using.' },
          { id: 'c', grade: 'proclaimed', verse: 'acts17_30', say: 'Christ’s apostles preached that God commands all people everywhere to repent.', reply: 'Repentance matters, certainly, though that sounds sterner than I usually frame it.' },
        ],
      },
      {
        after: 420, // a newer kind of conversation: appears later in the generation
        statement: 'Jesus is important, absolutely. I just do not think He is the only way. Surely all sincere paths lead uphill if people mean well.',
        choices: [
          {
            id: 'onlyway', grade: 'strong', label: 'BIBLICALLY GROUNDED',
            text: 'If Jesus is only one path among many, what do you do with His claim to be the only way to the Father?',
            feedback: 'It takes the person’s warmth seriously while bringing Christ’s own exclusive claim to the center of the question.',
            reply: 'We read that more broadly. They keep smiling, but more carefully now.',
          },
          {
            id: 'convincing', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'I agree Jesus is important, but I have found His way most convincing.',
            feedback: 'Sincere, but still framed as private preference. The issue is not what feels most compelling, but what Christ actually claimed.',
            reply: 'And I respect that. I simply hope God is wider than our categories.',
          },
          {
            id: 'mountain', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'Maybe we are all describing the same mountain from different sidewalks.',
            feedback: 'It gives away Christ’s uniqueness by treating contradictory gospels as compatible perspectives on one truth.',
            reply: 'That is graciously put. We may not be far apart at all, then.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'john14_6', say: 'Jesus did not present Himself as one good trail among several. He said He is the way, the truth, and the life.', reply: 'That leaves less room for a broad umbrella than many people prefer, including me.' },
          { id: 'b', grade: 'relevant', say: 'I get why that sounds charitable. But if Christ really rose, He does not leave us room to edit Him into a symbol.', reply: 'That is a thoughtful way to put the tension, I admit.' },
          { id: 'c', grade: 'proclaimed', verse: 'romans1_20', say: 'God’s eternal power and divine nature are clearly seen in the things that have been made.', reply: 'Creation is wonderful. I am talking about whether religions can truly disagree.' },
        ],
      },
      {
        after: 840, // a newer kind of conversation: appears later in the generation
        statement: 'Our organization helps people read Scripture correctly. Otherwise everyone just ends up with private opinions and coffee-shop theology.',
        choices: [
          {
            id: 'underword', grade: 'strong', label: 'FOUNDATION EXPOSED',
            text: 'Does God’s word need another authority over it, or should every teacher stand under it?',
            feedback: 'It goes to the foundation: teachers may serve Scripture, but they must never function as a higher authority that completes or controls it.',
            reply: 'Under it, of course. We just believe we have reliable guidance. They tap the laminated chart.',
          },
          {
            id: 'teachers', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Teachers can help, but I think local churches do that well.',
            feedback: 'Helpful, but still too pragmatic. The deeper issue is whether any organization may bind the conscience beyond Scripture.',
            reply: 'Fair enough. We simply try to offer clearer guidance than most.',
          },
          {
            id: 'organization', grade: 'weak', label: 'ASSURANCE LEFT STANDING',
            text: 'That makes sense. Most people do need an organization to tell them what it means.',
            feedback: 'It leaves false authority standing by suggesting that God’s word is insufficient without an institution controlling its meaning.',
            reply: 'Exactly. Independent reading can become terribly messy.',
          },
        ],
        next: [
          { id: 'a', grade: 'direct', verse: 'proverbs30_5', say: 'Teachers can serve the word, but they may not sit above it. God says His word proves true, and we must not add to it.', reply: 'You are drawing a sharper line than most people do, but I see why.' },
          { id: 'b', grade: 'relevant', say: 'I do appreciate that you came prepared; you are putting more effort into this corner than half the commuters.', reply: 'We did both bring handouts, did we not? At least we are committed to print.' },
          { id: 'c', grade: 'proclaimed', verse: 'acts17_30', say: 'Even on questions of authority, God commands all people everywhere to repent.', reply: 'Repentance matters, certainly, though that does not answer interpretation by itself.' },
        ],
      },
    ],
    reactions: {
      low: ['They smile, thank you politely, and move to the next doorway.', 'They tuck the brochure back into the tote and keep the tone warm but closed.'],
      mid: ['They nod slowly. “You have given me a real point to consider.”', 'They leave you a brochure anyway, as if mutual literature exchange is only fair.'],
      high: ['They linger with a thoughtful smile. “I appreciate that you actually listened.”', 'They glance at your tract stack and chuckle. “We may need adjacent folding tables.”'],
    },
  },
};
export const ENCOUNTER_UI = {
  respond: 'How do you respond?',
  respondNext: 'What do you say next?',
  respondBoss: 'Choose how to answer',
  rebut: 'He answers back. How do you reply?',
  apply: 'Bring a passage',
  skip: 'Move on without a passage',
  wordReady: 'The Word is ready: the passage carries fuller weight.',
  outcomeNote: 'You were faithful. The outcome belongs to God.',
  skipped: 'You moved on without bringing a passage.',
};
export const ENCOUNTER_ORDER = ['skeptic', 'nominal', 'broken', 'worker', 'visitor'];

// After a conversation: what fell short (so the strongest path can be found), and what learning it means.
export const COACH = {
  response: 'Your response',
  line: {
    relevant: 'What you said was honest and human, but what they raised went unanswered. A line that brings Scripture to it would have gone further.',
    proclaimed: 'The words were true, but they were not aimed at what was asked. Hear them first, then bring the passage that fits.',
    skipped: 'No line was said, so what they raised went unanswered.',
  },
  learned: 'Learned. You know how to talk with someone about this now: next time, just tap the seed over them to gather it.',
  familiar: 'You know where this one stands. Next time, tap the seed over them to gather what you reached, or tap them to talk it through again.',
  learnedHelper: (name) => `${name} can gather it for you when you are busy.`,
  learnedNoHelper: 'Once a disciple stands with you, they can gather it for you when you are busy.',
  automated: (helper, person, seeds) => `${helper} talked with ${person}, the way you would have. +${seeds} Seeds`,
  said: 'What you said',
  summary: (n, total) => `Conversations you have learned: ${n} of ${total}.`,
  summaryHelp: 'When you meet someone you know, tap the seed over them to gather it without talking. A trained disciple gathers it for you if you do not, for less; and a person who comes to faith is never passed over quietly.',
  summaryHow: 'Answer with the strongest response and a line that speaks to what was raised, and it is learned. Talk a situation through twice without finding that path and it becomes familiar: you can gather it at the best you reached.',
};

// How directly a passage applies is a gradient, never right-versus-wrong: every passage is God's true Word.
// In conversations each person has three things you can say next: one that draws on Scripture and answers what they raised
// (direct), one that is honest and human (relevant), and one that recites a true passage not aimed at the question (proclaimed).
export const APPLICATION_TEXT = {
  direct: { label: 'DIRECT APPLICATION', note: 'This passage speaks directly to what was raised.' },
  contextual: { label: 'CONTEXTUAL TRUTH', note: 'True and fitting. It speaks to the heart of the matter from another angle.' },
  relevant: { label: 'RELEVANT TRUTH', note: 'True and worth hearing, though it touches the issue more broadly.' },
  proclaimed: { label: 'WORD PROCLAIMED', note: 'God’s Word, spoken. It is true and it goes out, though it was not aimed at this question.' },
};

export const CONVERT_NAMES = ['Marcus', 'Ana', 'Dev', 'Lin', 'Tobias', 'Imani', 'Sofia', 'Jonah', 'Mara', 'Caleb', 'Yuki', 'Rosa'];

export const DISCIPLES = {
  ruth: {
    name: 'Ruth',
    role: 'A believer from a neighborhood church',
    intro: 'Ruth has watched you from the bench for weeks. “Let me stand with you.”',
    look: { skin: '#c28a62', hair: '#7a7a82', top: '#9a4a4a', bottom: '#33384a' },
  },
  tomas: {
    name: 'Tomás',
    role: 'A student who wants to know the Scriptures',
    intro: 'Tomás comes to every study with questions and a worn notebook.',
    look: { skin: '#a8734f', hair: '#1a1410', top: '#4a7a9a', bottom: '#30303a' },
  },
  hannah: {
    name: 'Hannah',
    role: 'A mother who knows the neighborhood',
    intro: 'Hannah knows who lives on every block, and who needs a visit.',
    look: { skin: '#e0b08a', hair: '#8a4a2a', top: '#5a8a5a', bottom: '#3a3a4a' },
  },
  elias: {
    name: 'Elias',
    role: 'A retired mechanic, steady and quiet',
    intro: 'Elias fixes what’s broken — and he is learning to teach others to do the same.',
    look: { skin: '#7a5238', hair: '#cfcfcf', top: '#6a6a7a', bottom: '#2b2f3a' },
  },
};
export const DISCIPLE_ORDER = ['ruth', 'tomas', 'hannah', 'elias'];
export const TIMOTHY_TEXT = {
  ref: '2 Timothy 2:2',
  text: '“What you have heard from me… entrust to faithful men, who will be able to teach others also.”',
};

export const BOSS = {
  name: 'The Professor',
  foreshadow: [
    'Overheard: “There’s a public lecture downtown tonight. The Professor — he’s brilliant.”',
    'Overheard: “He’s taken on pastors before. It’s always a good debate.”',
    'A banner is going up across the plaza: PUBLIC LECTURE · “Is Belief Reasonable?”',
  ],
  available: 'The Professor has begun a public talk — and he has noticed you.',
  intro: [
    { who: 'Narrator', text: 'A crowd gathers at the plaza. The Professor lowers his notes.' },
    { who: 'The Professor', text: '“You’re the street preacher. Let’s have an honest conversation, shall we?”' },
  ],
  phases: [
    {
      id: 'naturalism',
      title: 'Naturalism',
      statement: '“There is no evidence God exists.”',
      transition: '“Fine — then what grounds your authority? You can’t prove the Bible with the Bible.”',
      applications: { direct: ['romans1_20'], contextual: ['proverbs30_5'], relevant: ['acts17_30', 'john14_6', 'romans3_23'] },
      rebuttal: {
        statement: '“Then the order of the universe is simply a brute fact. Why add a God to explain it?”',
        choices: [
          {
            id: 'mind', grade: 'strong', label: 'FOUNDATION EXPOSED',
            text: 'A brute fact cannot explain why anything is rational. A Mind who made it orderly can, and your own reasoning depends on that order.',
            feedback: 'You pressed the point that an unexplained order cannot ground reason, and offered the answer that can.',
            reply: '“…Depends on the order. I will have to sit with that.”',
          },
          {
            id: 'cause', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Because everything that begins has a cause, and the universe began.',
            feedback: 'A fair argument, but he can answer it on his own ground without facing what grounds reason itself.',
            reply: '“Physics has its own view of causes. We will disagree.”',
          },
          {
            id: 'maybe', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'Maybe you are right. Nobody can really know these things for sure.',
            feedback: 'It gives away the ground that God has made Himself known.',
            reply: '“Thank you. That is all I was saying.”',
          },
        ],
      },
      choices: [
        {
          id: 'standard', grade: 'strong', label: 'FOUNDATION EXPOSED',
          text: 'Whose standard of evidence? Every argument you make assumes logic, order and moral duty. Whose world makes sense of those?',
          feedback: 'You questioned the foundation of the objection instead of arguing on his ground.',
          reply: '“Logic, observation… those are just there. Everyone relies on them.”',
        },
        {
          id: 'design', grade: 'partial', label: 'PARTIAL ANSWER',
          text: 'There is strong evidence: the order of nature and the beginning of the universe point to a Creator.',
          feedback: 'Sound as far as it goes, but it accepts him as the neutral judge of the evidence.',
          reply: '“The old design argument. Evolution answers that, and cosmology has its own account.”',
        },
        {
          id: 'faith', grade: 'weak', label: 'GROUND SURRENDERED',
          text: 'Belief in God is ultimately a matter of faith, not evidence.',
          feedback: 'It concedes the premise that belief in God has no ground.',
          reply: '“Faith. So you admit there is no evidence. Thank you.”',
        },
      ],
    },
    {
      id: 'authority',
      title: 'Authority',
      statement: '“You can’t use the Bible to prove the Bible.”',
      transition: '“Suppose I grant that. Even if God exists — why should I submit to Him?”',
      applications: { direct: ['proverbs30_5'], contextual: ['romans1_20', 'acts17_30'], relevant: ['john14_6'] },
      rebuttal: {
        statement: '“Then you are reasoning in a circle, and a circle proves nothing.”',
        choices: [
          {
            id: 'all-circles', grade: 'strong', label: 'FOUNDATION EXPOSED',
            text: 'Every ultimate authority vouches for itself, reason included. The question is which one can account for reason. The God who made minds can; nothing else does.',
            feedback: 'You showed the circle is not unique to Scripture, and pointed to the authority that grounds reason.',
            reply: '“So we all stand on something we cannot prove from outside. Uncomfortable.”',
          },
          {
            id: 'confirmed', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'It is not circular: history and archaeology confirm what the Bible records.',
            feedback: 'True and useful evidence, but it leaves the question of ultimate authority unanswered.',
            reply: '“Confirming some events is not confirming the claims.”',
          },
          {
            id: 'trust', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'It is circular. All I can do is ask you to trust it.',
            feedback: 'It concedes the charge and offers only personal trust.',
            reply: '“Trust is not an argument. Thank you for admitting it.”',
          },
        ],
      },
      choices: [
        {
          id: 'ultimate', grade: 'strong', label: 'FOUNDATION EXPOSED',
          text: 'Every ultimate authority vouches for itself. The question is which one can account for reason itself.',
          feedback: 'You showed his own standard is also ultimate and self-vouching, so the question is which authority makes sense of reason.',
          reply: '“Every ultimate authority vouches for itself… including mine, you are saying.”',
        },
        {
          id: 'history', grade: 'partial', label: 'PARTIAL ANSWER',
          text: 'Historians have good reasons to trust the manuscripts and the accounts of Jesus.',
          feedback: 'True and helpful, but it does not address the question of ultimate authority.',
          reply: '“Reliable manuscripts. Reliable is not the same as true, or binding.”',
        },
        {
          id: 'simply', grade: 'weak', label: 'GROUND SURRENDERED',
          text: 'You’re right, I can’t prove it. It is simply what I believe.',
          feedback: 'It concedes the Scriptures have no ground beyond personal preference.',
          reply: '“So it is preference. Then it has no claim on me.”',
        },
      ],
    },
    {
      id: 'autonomy',
      title: 'Autonomy',
      statement: '“Even if God exists, why should I submit to Him?”',
      transition: '',
      applications: { direct: ['acts17_30'], contextual: ['romans3_23', 'john14_6'], relevant: ['proverbs30_5'] },
      rebuttal: {
        statement: '“A loving God would not demand submission. Let people be free.”',
        choices: [
          {
            id: 'grace', grade: 'strong', label: 'BIBLICALLY GROUNDED',
            text: 'He does not only demand. The God who made you came in Jesus and bore your rebellion Himself. He calls you back out of love.',
            feedback: 'You held His claim and His grace together: the call to come back is the gospel.',
            reply: '“…You make it sound like an invitation I have been refusing.”',
          },
          {
            id: 'order', grade: 'partial', label: 'PARTIAL ANSWER',
            text: 'Without God’s standard, people cannot agree on right and wrong, and society suffers.',
            feedback: 'It argues for a moral order but leaves out the gospel that reconciles.',
            reply: '“Plenty of decent people agree on morals without Him.”',
          },
          {
            id: 'free', grade: 'weak', label: 'GROUND SURRENDERED',
            text: 'You are right. God would not force anyone. Everyone should follow what seems right to them.',
            feedback: 'It gives up that God’s claim on a person is real.',
            reply: '“Then we agree. Everyone is free to ignore it.”',
          },
        ],
      },
      choices: [
        {
          id: 'reconcile', grade: 'strong', label: 'BIBLICALLY GROUNDED',
          text: 'You were made by Him and answer to Him. But the invitation is to be reconciled through Christ, who bore the penalty for rebels.',
          feedback: 'You named both his accountability and the gospel of reconciliation.',
          reply: '“Reconciled… you make it sound like an invitation more than an order.”',
        },
        {
          id: 'judgment', grade: 'partial', label: 'PARTIAL ANSWER',
          text: 'Because He is powerful and He will judge you either way.',
          feedback: 'The judgment is real, but this leaves out the good news of grace.',
          reply: '“Threats. Is that all this is? Fear of punishment?”',
        },
        {
          id: 'choose', grade: 'weak', label: 'GROUND SURRENDERED',
          text: 'Maybe you shouldn’t, if it doesn’t suit you. Everyone has to decide for themselves.',
          feedback: 'It concedes that God’s claim on a person is optional.',
          reply: '“Exactly. Each person decides. Then we agree.”',
        },
      ],
    },
  ],
  victory: [
    'The Professor is quiet for a long moment. “…You’ve given me something to think about.”',
    'He does not yield today. But the crowd heard Scripture clearly — and some linger to ask questions.',
  ],
  verseVictory: { ref: '2 Corinthians 10:5', text: '“…take every thought captive to obey Christ.”' },
  window: {
    title: 'The crowd is listening',
    body: 'The plaza is full and attentive. Work the crowd while they listen.',
    reactions: {
      strong: 'The crowd murmurs: he had no ready answer.',
      partial: 'Some in the crowd nod; others wait to hear more.',
      weak: 'The crowd is unsure who has the better of it.',
    },
    end: (n, bonus) => (n > 0 ? `${n} conversations in the crowd. The next argument will be a little easier to answer (${Math.round(bonus * 100)}%).` : 'The crowd drifts back to listening. The next argument comes at full strength.'),
  },
  concession: 'He pauses. “Fair point. Let me put it differently…”',
  debrief: {
    scripture: 'Scripture carried too little of the exchange. Match the passage to what he actually argues.',
    crowd: 'The crowd was listening and you barely spoke with them. Their attention matters.',
    disciples: 'Few helpers stood with you. Disciples carry a conversation when your hands are full.',
    upgrades: 'You are holding Seeds you could still invest in your witness.',
    preparation: 'Your ministry may not yet carry enough weight for this exchange. Grow it, then return.',
    chooseLine: 'Choose your line early: the response that questions his foundation sets up everything after it.',
    rebuttal: 'When he answers back, the reply matters as much as the first one: a strong answer breaks his argument open, and a weak one lets him press on.',
    twice: 'Try this: pick the line that questions his foundation, bring the passage that answers his argument, and work the crowd in the windows.',
    practice: 'It was close. A stronger response and a better-chosen passage will tip it.',
  },
  passed: 'The lecture ends and the crowd drifts away. The opportunity passes. Nothing is lost — and God’s Word has not failed. Try again when you’re ready.',
};

export const CONVERSION_TEXT = {
  title: 'God Gives the Growth',
  verse: { ref: '1 Corinthians 3:7', text: 'So neither he who plants nor he who waters is anything, but only God who gives the growth.' },
  line: (name) => `${name} has turned to Christ. You planted; God gave the growth.`,
  windVerse: { ref: 'John 3:8', text: 'The wind blows where it wishes… so it is with everyone who is born of the Spirit.' },
};

export const INTRO = {
  title: 'IdleVangelist',
  lines: [
    'A cold, crowded city. Everyone is hurrying somewhere.',
    'You are a street evangelist — alone, for now. Your calling is faithful witness: speak the gospel, use God’s Word, serve others, and trust Him with the results.',
  ],
  verse: { ref: '1 Corinthians 3:6–7', text: 'I planted, Apollos watered, but God gave the growth.' },
  start: 'Begin',
};

export const GOSPEL = {
  title: 'The Good News',
  points: [
    'God is holy, and He rules all things.',
    'We have all sinned against Him and are guilty.',
    'Jesus Christ — truly God and truly man — died in the place of sinners and rose bodily from the dead.',
    'Repent and trust in Christ. Salvation is by grace, a gift — not earned.',
  ],
};

export const HINTS = {
  street: 'Tap people with a speech bubble to share a tract. Quick, steady moments build your Active Witness streak.',
  standFirm: 'Steady faithfulness brings a short burst of fruitful work: more people open, and your Seeds go further.',
  firstPurchase: 'Seeds are faithful witness planted. Spend them on Tracts to keep sowing while you work.',
  word: 'Proclaiming the Word charges as you work the street, and slowly on its own. When it is ready, proclaim Scripture to the whole street: people open to a moment hear it fully, and everyone else nearby hears it too.',
  wordReady: 'The Word is ready. Proclaim Scripture to the street: those open to a moment hear it fully, others nearby in passing. A fuller street means more people hear it.',
  wordHold: 'There is no one on the street right now. Keep the Word until people gather.',
  special: 'Someone in the crowd wants to talk. Tap them before they pass.',
  helper: 'When the teal bar runs out, your disciple will gather this one for you (for less). Tap the seed first to gather it yourself.',
  harvest: 'You know this conversation. Tap the seed over them to gather it: no need to talk it through again.',
  respond: 'Choose how to respond, then bring a passage that speaks to it. Every verse is true; some speak more directly to what was said.',
  funds: 'Provisions are for supplies only — literature, equipment, space. Not for anything spiritual.',
  disciple: 'Disciples help carry your ministry and stand with you in the exchanges ahead.',
  boss: 'The Professor is in the plaza. You may attempt the exchange any time — failure costs nothing.',
  lecture: 'The word is getting around about the Professor’s lecture. Every person you reach helps a crowd gather.',
  leaving: 'Holding the Word for a bigger street? People whose moment is passing show a short bar over them: when it runs out, they are gone.',
  crest: 'The street is at its fullest and starting to thin. Proclaim now, and it carries further.',
  chain: 'Every fifth successive tap pays a chain bonus. Keep the run going.',
  miss: 'Tapping where no one has a bubble breaks your run a little. Keep your taps on people with a speech bubble.',
  streakBar: 'The bar under Active Witness is how long your run lasts without another engagement. The hotter the run, the shorter it is.',
  crowdEvent: 'Gatherings differ: a crowd all at once is the moment for a held proclamation; a steady stream is the moment to tap.',
  ministryTick: 'Each ministry reports what it produced every few seconds. Watch the street: tables, helpers and gatherings grow as you invest.',
};

export const GEN_COMPLETE = {
  title: 'Generation Complete',
  blurb: 'You were faithful with what you were given. The fruit belongs to God.',
  verse: { ref: 'Matthew 28:18–20', text: '“All authority in heaven and on earth has been given to me… make disciples of all nations.”' },
  faithfulnessNote: 'Faithfulness is enduring generational fruit — a gift of grace you carry forward, not something purchased.',
};

export const NEXT_GENERATION = {
  psalm: { ref: 'Psalm 145:4', text: 'One generation shall commend your works to another, and shall declare your mighty acts.' },
  habakkuk: { ref: 'Habakkuk 2:14', text: 'The earth will be filled with the knowledge of the glory of the Lord as the waters cover the sea.' },
  beats: [
    { at: 0.0, text: 'Years pass.' },
    { at: 2.2, text: 'The old evangelist steps back. Others carry the work forward.' },
    { at: 4.8, text: 'The believers remain. The street begins to mend.' },
    { at: 7.4, text: 'A younger evangelist steps onto the street.' },
  ],
  title: 'NEXT GENERATION',
  duration: 11.5,
};

export const GEN2_PREVIEW = {
  title: 'Generation II',
  body: 'Your witness bore fruit that will outlast you. A future generation will begin with what you have passed on.',
  locked: 'Generation II gameplay arrives in a future build.',
};

export const BRAND = { subtitle: 'Faithful witness. God gives the growth.' };

// Shown when a ministry crosses a visual milestone (owned 1 / 5 / 10 / 25) and the street visibly changes.
export const MILESTONE_TEXT = {
  tracts: ['A table of tracts', 'A bigger stack of tracts', 'A literature rack', 'A second table of literature'],
  bibles: ['A stack of free Bibles', 'More Bibles on the table', 'Crates of Bibles', 'A Bible distribution point'],
  streetTeam: ['A helper joins you', 'Your street team is growing', 'Your street team is growing', 'A full street team works the crowd'],
  bibleStudy: ['A Bible study begins', 'The study group grows', 'The study meets under cover', 'A thriving Bible study'],
  discipleship: ['Discipleship begins', 'The gathering grows', 'A larger gathering', 'A community of believers'],
};

// Street happenings: each kind of gathering says what it is and what it asks of you.
export const CROWD_EVENTS = {
  bus: 'A bus pulls up and a crowd steps off together. A good moment to proclaim.',
  lunch: 'Lunch break: a steady stream of people. Keep tapping and your run will hold.',
  school: 'School lets out: two fast waves, one from each side!',
  rain: 'The rain eases and people linger. Someone looks like they might want to talk.',
  church: 'Friends from a nearby church stop to pray with you. You feel encouraged.',
};

// A little life for the people God has brought to Christ (display only).
export const CONVERT_LINES = [
  (n) => `${n} hands out a tract`,
  (n) => `${n} invites a neighbor`,
  (n) => `${n} shares what happened`,
];

export const OFFLINE_FLAVOR = {
  tracts: 'Tracts kept finding their way into hands.',
  bibles: 'Bibles waited on tables and in bags to be read.',
  streetTeam: 'Your street team stayed faithful on the corner.',
  bibleStudy: 'The Bible study kept meeting.',
  discipleship: 'Disciples kept teaching others also.',
};

// The street changes character as the day goes on (Chapter n begins at BALANCE.chapterSeconds[n]).
export const CHAPTERS = [
  { name: 'Morning rush', line: 'The street is waking up.', kinds: ['bus', 'rain'] },
  { name: 'Midday', line: 'The street fills.', kinds: ['lunch', 'bus', 'church'] },
  { name: 'Afternoon', line: 'Long shadows. People have more time to talk.', kinds: ['school', 'rain', 'lunch'] },
  { name: 'Evening', line: 'The lecture hour draws near.', kinds: ['rain', 'bus', 'church', 'school'] },
];

// The regulars: people you keep running into on the street.
// Archetypes whose art is a woman take a name from this list, so the name on the card matches the person on the street.
export const WOMEN_NAMES = ['Dana', 'Priya', 'Mei', 'Ingrid', 'Nia', 'Hana', 'Alma', 'Greta', 'Lena', 'Zara'];
export const NAME_POOL_BY_ARCHETYPE = { nominal: WOMEN_NAMES };
export const PEOPLE_NAMES = ['Dana', 'Omar', 'Priya', 'Jake', 'Mei', 'Luis', 'Ingrid', 'Sam', 'Nia', 'Victor', 'Hana', 'Theo', 'Alma', 'Ravi', 'Greta', 'Kofi', 'Lena', 'Mateo', 'Zara', 'Henry'];

export function personOutcome(p) {
  const times = p.meetings === 1 ? 'one conversation' : `${p.meetings} conversations`;
  if (p.converted) return `${times}. Came to Christ. You planted; God gave the growth.`;
  if (p.lastQ >= 0.75) return `${times}. Listened closely and kept thinking.`;
  if (p.lastQ >= 0.45) return `${times}. Paused to think.`;
  return `${times}. Walked on unconvinced. God is not finished with them.`;
}

export const STAND_FIRM = { name: 'STAND FIRM', verse: { ref: '1 Corinthians 15:58', text: 'Be steadfast, immovable, always abounding in the work of the Lord.' } };
