import React from 'react'
import { initDriver, getDriver, closeDriver } from '../neo4j'
import { toNativeTypes } from '../utils'
import _ from 'lodash'

export default class Filter extends React.Component {

    constructor(props) {
        super(props)
        initDriver(this.props.uri, this.props.user, this.props.password)
        this.driver = getDriver()
        this.state = {
            // original data pulled from Neo4j
            chapter: [],
            characters: [],
            charNum: 0,
            speaker: [],
            addressee: [],
            genders: [], 
            // value for the filters
            selectedChapter: "Any",
            selectedSpeaker: "Any",
            selectedAddressee: "Any",
            selectedSpeakerGender: "Any",
            selectedAddresseeGender: "Any",
            // adjmat_SA[speaker index][addressee index] = 0 for no, 1 for yes, where index is index of character in the list of characters. Direction sensitive.
            adjmat_SA: [], 
            // chp_SA[0][0] = ['Kiritsubo Consort', 'Kiritsubo Emperor'], i.e. 01KR01 is spoken by K.C. to K.E.
            chp_SA: [],
            // lists of filter options
            chapterList: [], 
            speakerList: [], 
            addresseeList: [],
            speakerGenderList: [],
            addresseeGenderList: [],
        }
    }

    async componentDidMount() {
        const getChp = 'match (c:Chapter) return (c) as chapters'
        const getExchange = 'match path=(c:Character)-[r:SPEAKER_OF]-(g:Genji_Poem)-[s:ADDRESSEE_OF]-(d:Character) return path'
        const getChar = 'match (c:Character) return c.name as char, c.gender as gender order by c.name'
        const session = this.driver.session()

        try {
            const resChp = await session.readTransaction(tx => tx.run(getChp))
            const resExchange = await session.readTransaction(tx => tx.run(getExchange))
            const resChar = await session.readTransaction(tx => tx.run(getChar))

            let tempChp = resChp.records.map(row => {return toNativeTypes(row.get('chapters'))}).map((chp) => chp.properties)
            let tempExchange = resExchange.records.map(row => {return toNativeTypes(row.get('path'))}).map(({segments}) => segments)
            let chars= resChar.records.map(row => {return toNativeTypes(row.get('char'))}).map(e => Object.values(e).join(''))
            let genders= resChar.records.map(row => {return toNativeTypes(row.get('gender'))}).map(e => Object.values(e).join(''))
            const charNum = chars.length //115 as of April 10th, 2022, 139

            let speakers = []
            let addressees = []
            let chapters = []
    
            tempExchange.forEach(([s, a]) => {
                speakers.push(s)
                addressees.push(a)
            })
            //speakers: [{start, relationship, end}...]
            tempChp.forEach((e) => {
                chapters.push([e.chapter_number, e.kanji, e.chapter_name])
            })
            //['1', '桐壺', 'Kiritsubo']
            this.setState({
                chapter: chapters,
                characters: chars,
                charNum: charNum,
                genders: genders,
                speaker: Array.from([...new Set(speakers.map(({start}) => start.properties.name))]).sort(),
                addressee: Array.from([...new Set(addressees.map(({end}) => end.properties.name))]).sort(),
                chapterList: chapters, 
                speakerList: Array.from([...new Set(speakers.map(({start}) => start.properties.name))]).sort(),
                addresseeList: Array.from([...new Set(addressees.map(({end}) => end.properties.name))]).sort(),
            }, () => {
                // init chapter to speaker&addressee mapping
                let chp_SA = new Array(this.state.chapter.length)
                for (let i = 0; i < speakers.length; i++) {
                    let chpnum = speakers[i].end.properties.pnum.substring(0, 2)
                    if (chpnum.substring(0, 1) === '0') {
                        chpnum = parseInt(chpnum.substring(1, 2))
                    } else {
                        chpnum = parseInt(chpnum)
                    }
                    if (chp_SA[chpnum-1] === undefined) {
                        chp_SA[chpnum-1] = [[speakers[i].start.properties.name, addressees[i].end.properties.name]]
                    } else {
                        chp_SA[chpnum-1].push([speakers[i].start.properties.name, addressees[i].end.properties.name])
                    }
                }
                // init adjacency mat
                let mat = []
                for (let i = 0; i < charNum; i++){
                    mat.push([])
                    for (let j = 0; j < charNum; j++){
                        mat[i][j] = 0
                    }
                }
                // if a future bug appears here, check if #addressee > #speaker
                // In addition, Genji has the most poems (225), so when the index of a spaker is identified in speakers, we search the next 250 entries for their prospective counterpart. 
                this.state.speaker.forEach(s => {
                    //for each speaker stored in this.state.speaker
                    let mat_s = chars.indexOf(s)
                    let scount = this.state.speaker.indexOf(s)
                    this.state.addressee.forEach(a => {
                        //for each addressee stored in this.state.addressee
                        let mat_a = chars.indexOf(a)
                        if (mat[mat_s][mat_a] === 0) {
                            // if the current adjmat entry for a pair of characters is 0, first find where does the speaker first appear in all the exchanges
                            let si = speakers.findIndex(e => e.start.properties.name === this.state.speaker[scount])
                            // no need to exclude si=-1 since si is indexed based on this.state.speakers 
                            // while si does not increment out of bounds of speaker list and si corresponds to the same name as the current speaker from the speaker list
                            while ((si < speakers.length) && speakers[si].start.properties.name === s) {
                                // if the addressee half of this exchange matches the this.state.addressee element being iterated through
                                if (addressees[si].end.properties.name === a) {
                                    mat[mat_s][mat_a] = 1
                                } 
                                si = si + 1
                            }
                        }
                    })
                })
                this.setState({
                    adjmat_SA: mat, 
                    chp_SA: chp_SA
                }, () => {
                    console.log('filter options set')
                })
            })
        } catch (e) {
            console.log('Error in filter: '+e)
        } finally {
            await session.close()
        }
        closeDriver()
    }

    render() {
        let updateSelection = (event) => {
            let type = event.target.id
            let lockedChapter, lockedSpeaker, lockedAddressee, lockedSpeakerGender, lockedAddresseeGender
            // Remember: selected value != options
            let validSpeakers = this.state.speakerList
            let validAddressees = this.state.addresseeList
            let validChapters = this.state.chapterList
            let validSpeakerGenders = ['male','female']
            let validAddresseeGenders = ['male','female','nonhuman']
            if (type === 'chapter') {
                lockedChapter = event.target.value.split(' ')
                // if a selected value is any, remap the rest of the constraints to remove this filter's effect
                if (lockedChapter[0] === 'Any') {
                    if (this.state.selectedAddressee === 'Any') {
                        validSpeakers = this.state.speaker
                    } else {
                        validSpeakers = []
                        let index = this.state.characters.indexOf(this.state.selectedAddressee)
                        for (let i = 0; i < this.state.characters.length; i++) {
                            if (this.state.adjmat_SA[i][index]) {
                                validSpeakers.push(this.state.characters[i])
                            }
                        }
                    } 
                    if (this.state.selectedSpeaker === 'Any') {
                        validAddressees = this.state.addressee
                    } else {
                        validAddressees = []
                        let index = this.state.characters.indexOf(this.state.selectedSpeaker)
                        for (let j = 0; j < this.state.characters.length; j++) {
                            if (this.state.adjmat_SA[index][j]) {
                                validAddressees.push(this.state.characters[j])
                            }
                        }
                    }
                }
                // if a filter has a specific selected option, update the constraints on other filters
                else {
                    let index = parseInt(lockedChapter[0]) - 1
                    if (this.state.selectedAddressee === 'Any') {
                        validSpeakers = new Set()
                        this.state.chp_SA[index].forEach(pair => validSpeakers.add(pair[0]))
                        validSpeakers = Array.from(validSpeakers).sort()
                    } else {
                        validSpeakers = new Set()
                        this.state.chp_SA[index].forEach(pair => {
                            if (pair[1] === this.state.selectedAddressee) {
                                validSpeakers.add(pair[0])
                            }
                        })
                        validSpeakers = Array.from(validSpeakers).sort()
                    }
                    if (this.state.selectedSpeaker === 'Any') {
                        validAddressees = new Set()
                        this.state.chp_SA[index].forEach(pair => validAddressees.add(pair[1]))
                        validAddressees = Array.from(validAddressees).sort()
                    } else {
                        validAddressees = new Set()
                        this.state.chp_SA[index].forEach(pair => {
                            if (pair[0] === this.state.selectedSpeaker) {
                                validAddressees.add(pair[1])
                            }
                        })
                        validAddressees = Array.from(validAddressees).sort()
                    }
                }
            } else if (type === 'speakerGender') {
                lockedSpeakerGender = event.target.value
                validAddresseeGenders = []
                if (lockedSpeakerGender !== "Any") {
                    for (let i = 0; i < validSpeakers.length; i++) {
                        if (this.state.genders[this.state.characters.indexOf(validSpeakers[i])] !== lockedSpeakerGender) {
                            validSpeakers.splice(i, 1)
                            i--
                        }
                    }
                    validAddressees.forEach(addr => {
                        let a = this.state.characters.indexOf(addr)
                        validSpeakers.every(spkr => {
                            if (!this.state.adjmat_SA[this.state.characters.indexOf(spkr)][a]) {
                                let rm = validAddressees.indexOf(addr)
                                validAddressees.splice(rm, 1)
                                return false
                            }
                        })
                    })
                    validAddresseeGenders = Array.from(new Set(validAddressees.map(addr => this.state.genders[this.state.characters.indexOf(addr)])))
                    // Fix chp_SA 41-43 empty issues next time
                    validChapters.forEach(chp => {
                        let count = 0
                        let emptyls = [42, 43, 44]
                        if (!emptyls.includes(parseInt(chp[0]))) {
                            let exchanges = this.state.chp_SA[parseInt(chp[0])-1]
                            for (let i= 0; i < exchanges.length; i++) {
                                let sg = this.state.genders[this.state.characters.indexOf(exchanges[i][0])]
                                let ag = this.state.genders[this.state.characters.indexOf(exchanges[i][1])]
                                if (sg === lockedSpeakerGender && validAddresseeGenders.includes(ag)) {
                                    count = 1
                                    break
                                }
                            }
                        }
                        if (!count) {
                            let rm = validChapters.indexOf(chp)
                            validChapters.splice(rm, 1)
                        }
                    })
                    validChapters.forEach(chp => {
                        if (parseInt(chp[0]) === 43){
                            let rm = validChapters.indexOf(chp)
                            validChapters.splice(rm, 1)
                        }
                    })
                }
            } else if (type === 'speaker') {
                lockedSpeaker = event.target.value
                if (lockedSpeaker === 'Any') {
                    if (this.state.selectedAddressee === 'Any') {
                        validChapters = this.state.chapter
                    } else {
                        // chapters are pushed in order so no need to sort
                        validChapters = []
                        for (let i = 0; i < 54; i++) {
                            if (this.state.chp_SA[i] !== undefined) {
                                for (let j = 0; j < this.state.chp_SA[i].length; j++) {
                                    if (this.state.chp_SA[i][j][1] === this.state.selectedAddressee) {
                                        validChapters.push(this.state.chapter[i])
                                        break
                                    }
                                }
                            }
                        }
                    }
                    if (this.state.selectedChapter === 'Any') {
                        validAddressees = this.state.addressee
                    } else {
                        validAddressees = Array.from(new Set(this.state.chp_SA[parseInt(this.state.selectedChapter)-1].map(pair => pair[1]))).sort()
                    }
                }
                // if we have a speaker selected
                else {
                    if (this.state.selectedAddressee === 'Any') {
                        validChapters = []
                        for (let i = 0; i < 54; i++) {
                            if (this.state.chp_SA[i] !== undefined) {
                                for (let j = 0; j < this.state.chp_SA[i].length; j++) {
                                    if (this.state.chp_SA[i][j][0] === lockedSpeaker) {
                                        validChapters.push(this.state.chapter[i])
                                        break
                                    }
                                }
                            }
                        }
                    } else {
                        validChapters = []
                        for (let i = 0; i < 54; i++) {
                            if (this.state.chp_SA[i] !== undefined) {
                                for (let j = 0; j < this.state.chp_SA[i].length; j++) {
                                    if (JSON.stringify(this.state.chp_SA[i][j]) === JSON.stringify([lockedSpeaker, this.state.selectedAddressee])) {
                                        validChapters.push(this.state.chapter[i])
                                        break
                                    }
                                }
                            }
                        }
                    }
                    if (this.state.selectedChapter === 'Any') {
                        validAddressees = []
                        this.state.adjmat_SA[this.state.characters.indexOf(lockedSpeaker)].forEach((value, i) => {
                            if (value) {
                                validAddressees.push(this.state.characters[i])
                            }
                        })
                    } else {
                        validAddressees = new Set()
                        this.state.chp_SA[parseInt(this.state.selectedChapter)-1].forEach(pair => {
                            if (pair[0] === lockedSpeaker){
                                validAddressees.add(pair[1])
                            }
                        })
                        validAddressees = Array.from(validAddressees).sort()
                    }
                }
            } else {
                // when the addressee filter is changed
                lockedAddressee = event.target.value
                if (lockedAddressee === 'Any') {
                    if (this.state.selectedSpeaker === 'Any') {
                        validChapters = this.state.chapter
                    } else {
                        // chapters are pushed in order so no need to sort
                        validChapters = []
                        for (let i = 0; i < 54; i++) {
                            if (this.state.chp_SA[i] !== undefined) {
                                for (let j = 0; j < this.state.chp_SA[i].length; j++) {
                                    if (this.state.chp_SA[i][j][0] === this.state.selectedSpeaker) {
                                        validChapters.push(this.state.chapter[i])
                                        break
                                    }
                                }
                            }
                        }
                    }
                    if (this.state.selectedChapter === 'Any') {
                        validSpeakers = this.state.speaker
                    } else {
                        validSpeakers = Array.from(new Set(this.state.chp_SA[parseInt(this.state.selectedChapter)-1].map(pair => pair[0]))).sort()
                    }
                }
                // if we have an addressee selected
                else {
                    if (this.state.selectedSpeaker === 'Any') {
                        validChapters = []
                        for (let i = 0; i < 54; i++) {
                            if (this.state.chp_SA[i] !== undefined) {
                                for (let j = 0; j < this.state.chp_SA[i].length; j++) {
                                    if (this.state.chp_SA[i][j][1] === lockedAddressee) {
                                        validChapters.push(this.state.chapter[i])
                                        break
                                    }
                                }
                            }
                        }
                    } else {
                        validChapters = []
                        for (let i = 0; i < 54; i++) {
                            if (this.state.chp_SA[i] !== undefined) {
                                for (let j = 0; j < this.state.chp_SA[i].length; j++) {
                                    // console.log(this.state.chp_SA[i][j])
                                    if (JSON.stringify(this.state.chp_SA[i][j]) === JSON.stringify([this.state.selectedSpeaker, lockedAddressee])) {
                                        validChapters.push(this.state.chapter[i])
                                        break
                                    }
                                }
                            }
                        }
                    }
                    if (this.state.selectedChapter === 'Any') {
                        validSpeakers = new Set()
                        _.unzip(this.state.adjmat_SA)[this.state.characters.indexOf(lockedAddressee)].forEach((value, i) => {
                            if (value) {
                                validSpeakers.add(this.state.characters[i])
                            }
                        })
                        validSpeakers = Array.from(validSpeakers)
                    } else {
                        validSpeakers = new Set()
                        this.state.chp_SA[parseInt(this.state.selectedChapter)-1].forEach(pair => {
                            if (pair[1] === lockedAddressee){
                                validSpeakers.add(pair[0])
                            }
                        })
                        validSpeakers = Array.from(validSpeakers).sort()
                    }
                }
            }
            this.setState({
                chapterList: validChapters,
                speakerList: validSpeakers, 
                addresseeList: validAddressees, 
                speakerGenderList: validSpeakerGenders,
                speakerAddresseeList: validAddresseeGenders,
            }, 
            () => {
                switch (type) {
                    case 'chapter':
                        this.setState({
                            selectedChapter: lockedChapter[0],
                        }, () => {
                            console.log('selections set')
                        }) 
                        break
                    case 'speaker':
                        this.setState({
                            selectedSpeaker: lockedSpeaker,
                        }, () => {
                            console.log('selections set')
                        }) 
                        break
                    case 'addressee':
                        this.setState({
                            selectedAddressee: lockedAddressee,
                        }, () => {
                            console.log('selections set')
                        }) 
                        break
                    case 'speakerGender':
                            this.setState({
                                selectedSpeakerGender: lockedSpeakerGender,
                            }, () => {
                                console.log('selections set')
                            }) 
                            break
                    default:
                        console.log('unknown select type caught')
                }
            })
        }
        return (
            <div>
                <form>
                    <label htmlFor="chapter">Choose a chapter</label>
                    <br />
                    <select 
                        id="chapter"
                        //value={formData.speaker}
                        onChange={updateSelection}
                        name="chapter"
                    >
                        <option value="Any">Any</option>
                        {this.state.chapterList.map((row) => <option key={row[2]}>{row[0]+' '+row[1]+' '+row[2]}</option>)}
                    </select>
                </form>
                <form>
                    <label htmlFor="speakerGender">Speaker's gender</label>
                    <br />
                    <select 
                        id="speakerGender"
                        //value={formData.speaker}
                        onChange={updateSelection}
                        name="speakerGender"
                    >
                        <option value="Any">Any</option>
                        <option value="male">male</option>
                        <option value="female">female</option>
                    </select>
                </form>
                <form>
                    <label htmlFor="speaker">Choose a speaker</label>
                    <br />
                    <select 
                        id="speaker"
                        //onClick={console.log('clicked spaker bar')}
                        onChange={updateSelection}
                        name="speaker"
                    >
                        <option value="Any">Any</option>
                        {this.state.speakerList.map((row) => <option key={row+'_s'}>{row}</option>)}
                    </select>
                </form>
                <form>
                    <label htmlFor="addresseeGender">Addressee's gender</label>
                    <br />
                    <select 
                        id="addresseeGender"
                        //value={formData.speaker}
                        onChange={updateSelection}
                        name="addresseeGender"
                    >
                        <option value="Any">Any</option>
                        <option value="male">male</option>
                        <option value="female">female</option>
                        <option value="nonhuman">nonhuman</option>
                    </select>
                </form>
                <form>
                <label htmlFor="addressee">Choose an addressee</label>
                <br />
                <select 
                    id="addressee"
                    //value={formData.speaker}
                    onChange={updateSelection}
                    name="addressee"
                >
                    <option value="Any">Any</option>
                    {this.state.addresseeList.map((row) => <option key={row+'_a'}>{row}</option>)}
                </select>
            </form>
        </div>
        )
    }
}