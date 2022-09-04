import React from 'react'
import { initDriver, getDriver, closeDriver } from '../neo4j'
import { toNativeTypes, getChpList } from '../utils'
import { Select, Checkbox, Col, Row, Collapse, Spin, Button } from 'antd';
import 'antd/dist/antd.min.css';
import { Link, Routes, Route, Outlet } from 'react-router-dom';
import { Home } from './Home';
const { Option } = Select;
const CheckboxGroup = Checkbox.Group;
const { Panel } = Collapse;

export default class Search extends React.Component {
    Graph = require("graph-data-structure")
    constructor(props) {
        super(props)
        this.state = {
            // original data pulled from Neo4j
            chapters: Array.from(Array(54), (_,i)=> i).map(e => e+1),
            characters: [],
            // charNum: 0,
            male_speakers: [],
            female_speakers: [],
            male_addressees: [],
            female_addressees: [],
            nonhuman_addressees: [],
            multiple_addressees: [],
            // values of the filters
            selectedChapters: ['anychp'],
            selectedSpeaker: ['Any'],
            selectedAddressee: ['Any'],
            selectedSpkrGen: ['male', 'female'],
            selectedAddrGen: ['male', 'female', 'multiple', 'nonhuman'],
            // A Graph of all options
            graph: this.Graph(),
            speakerGenderList: ['male', 'female'],
            addresseeGenderList: ['male', 'female', 'multiple', 'nonhuman'],
            filterActiveKey: ['panel1'],
            openOptions: true,
            backup: [],
        }
        this.uri = process.env.REACT_APP_NEO4J_URI
        this.user = process.env.REACT_APP_NEO4J_USERNAME
        this.password = process.env.REACT_APP_NEO4J_PASSWORD

        this.chpFilterRef = React.createRef(null)

        this.hasNode = this.hasNode.bind(this)
        // this.selected = this.selected.bind(this)
        // this.deselected = this.deselected.bind(this)
        this.handleChpChange = this.handleChpChange.bind(this)
        this.handleSpkrGenChange = this.handleSpkrGenChange.bind(this)
        this.handleAddrGenChange = this.handleAddrGenChange.bind(this)
        this.handleGenHelper = this.handleGenHelper.bind(this)
        this.handleSpkrChange = this.handleSpkrChange.bind(this)
        this.handleAddrChange = this.handleAddrChange.bind(this)
        this.checkCharInChp = this.checkCharInChp.bind(this)
        this.checkGender = this.checkGender.bind(this)
        this.checkHasExchangeInChp = this.checkHasExchangeInChp.bind(this)
        this.getIntersection = this.getIntersection.bind(this)
        this.togglePanel = this.togglePanel.bind(this)
    }

    // returns true if node is in graph, false otherwise
    hasNode(graph, node) {
        let prev = JSON.stringify(graph.nodes())
        let after = JSON.stringify(graph.addNode(node).nodes())
        return prev === after
    }

    // returns the intersection of two CHARACTERS lists
    getIntersection(ls1, ls2) {
        return ls1.map(e => {
            if (e[1] && ls2.some(f => f[0]===e[0] && f[1])) {
                return e
            } else {
                return [e[0], 0]
            }
        })
    }

    // Takes the current list of chars and its type as input when an unchecked gender is checked, filters a character list based on chapter and the other character filter, and returns the character list that enables the enabled intersection of the two filters. 
    handleGenHelper(chars) {
        let chpFiltered = chars
        let charFiltered = chars
        // if selected a chapter, then set chpFiltered to only the ones enabled by the chps. Else, go with the chars. 
        if (this.state.selectedChapters.length !== 0 && this.state.selectedChapters[0] !== 'anychp') {
            let chpFiltered = chars.map(e => [e[0], 0])
            let chps = [...this.state.selectedChapters]
            // here we can optimize by counting disabled chars when chps are many, counting enabled chars when chps are few
            let enabled_char = new Set()
            chps = chps.map(chp => this.checkCharInChp(chars, this.state.graph, chp, false))
            chps.forEach(chp => chp.forEach(e => {
                if (e[1]) {
                    enabled_char.add(e)
                }
            }))
            chpFiltered.map(e => {
                if (enabled_char.has([e[0], true])) {
                    return [e[0], 1]
                }
            })
        } else if (this.state.selectedChapters[0] === 'anychp') {
            // if any is selected for chp
            chpFiltered = chars.map(e => [e[0], 1])
        }
        // if both char filters are empty
        if (this.state.selectedSpeaker.length === 0 && this.state.selectedAddressee.length === 0) {
            charFiltered = chars.map(e => [e[0], 1])
        } else if (this.state.selectedSpeaker.length !== 0 || this.state.selectedAddressee.length !== 0) {
            // if it is the speaker/addressee filter getting updated and is not empty
            let curr_ls
            if (this.state.selectedSpeaker.length !== 0) {
                curr_ls = this.state.selectedSpeaker
            } else {
                curr_ls = this.state.selectedAddressee
            }
            for (let i = 0; i < chars.length; i++) {
                for (let j = 0; j < this.state.curr_ls.length; j++) {
                    let char = this.checkHasExchange(chars[i], this.state.curr_ls[j], this.state.graph)
                    if (char[1]) {
                        charFiltered.push(char)
                        break
                    }
                }
                charFiltered.push([chars[i][0],0])
            }
        } else {
            // if either spkr/addr is any
            let prev = chars
            for (let j = 0; j < this.state.selectedChapters.length; j++) {
                let curr = this.checkCharInChp(chars, this.state.graph, this.state.selectedChapters[j], false)
                chars = this.getIntersection(prev, curr)
            }
        } 
        return this.getIntersection(chpFiltered, charFiltered)
    }

    // resets relative character lists and calls other filters
    handleSpkrGenChange(value) {
        let male_speakers = [...this.state.male_speakers]
        let female_speakers = [...this.state.female_speakers]
        if (value.includes('male')) {
            male_speakers = this.handleGenHelper(male_speakers)
        } else if (!value.includes('male')) {
            male_speakers = male_speakers.map(char => [char[0], 0])
        }
        if (value.includes('female')) {
            female_speakers = this.handleGenHelper(female_speakers)
        } else if (!value.includes('female')) {
            female_speakers = female_speakers.map(char => [char[0], 0])
        }
        this.setState({
            selectedSpkrGen: value,
            male_speakers: male_speakers,
            female_speakers: female_speakers,
        })
    }

    handleAddrGenChange(value) {
        let male_addressees = this.state.male_addressees
        let female_addressees = this.state.female_addressees
        let nonhuman_addressees = this.state.nonhuman_addressees
        let multiple_addressees = this.state.multiple_addressees
        if (value.includes('male')) {
            male_addressees = this.handleGenHelper(male_addressees)
        } else if (!value.includes('male')) {
            male_addressees = male_addressees.map(char => [char[0], 0])
        }
        if (value.includes('female')) {
            female_addressees = this.handleGenHelper(female_addressees)
        } else if (!value.includes('female')) {
            female_addressees = female_addressees.map(char => [char[0], 0])
        }
        if (value.includes('nonhuman')) {
            nonhuman_addressees = this.handleGenHelper(nonhuman_addressees)
        } else if (!value.includes('nonhuman')) {
            nonhuman_addressees = nonhuman_addressees.map(char => [char[0], 0])
        }
        if (value.includes('multiple')) {
            multiple_addressees = this.handleGenHelper(multiple_addressees)
        } else if (!value.includes('multiple')) {
            multiple_addressees = multiple_addressees.map(char => [char[0], 0])
        }
        this.setState({
            selectedAddrGen: value,
            male_addressees: male_addressees,
            female_addressees: female_addressees, 
            nonhuman_addressees: nonhuman_addressees, 
            multiple_addressees: multiple_addressees,
        })
    }

    // sets the characters of a chapter to flag and returns the character list. flag should be false for select, true for deselect
    checkCharInChp(chars, graph, chp, flag) {
        chars.forEach(char => {
            let selectedChapters = [...this.state.selectedChapters]
            selectedChapters.splice(selectedChapters.indexOf(chp), 1)
            try {
                graph.shortestPath(char[0], chp)
                selectedChapters = selectedChapters.map(sc => graph.lowestCommonAncestors(char[0], sc)[0] === sc)
                if (!selectedChapters.includes(true)) {
                    char[1] = !flag
                }
            } catch(e) {}
        })
        return chars
    }

    // checkChpHasChar(chps, graph, char, flag) {

    // }

    // sets the characters of a certain gender based on selected genders and returns the character list. flag: true for select, false for deselect
    checkGender(chars, gender, selectedGenders){
        if (!selectedGenders.includes(gender)) {
            chars = chars.map(char => [char[0], 0])
        }
        return chars
    }

    // returns a character with their display set by the existence of their exchange with another character
    checkHasExchange(c1, c2, graph) {
        let lca = graph.lowestCommonAncestors(c1[0], c2)
        if (lca.filter(e => typeof(e) === 'Number').length === lca.length) {
            return [c1[0], 0]
        } else {
            return [c1[0], 1]
        }
    }

    // sets the first input character's display by the presence of an exchange between the two in a chapter, returns the character 
    checkHasExchangeInChp(c1, c2, chp, graph) {
        let lca = graph.lowestCommonAncestors(c1[0], c2)
        if (lca.some(e => graph.adjacent(e).includes(chp))) {
            c1[1] = 1
        } else {
            c1[1] = 0
        }
        return c1
    }


    handleChpChange(value) {
        let difference
        let prevChps = this.state.selectedChapters
        let male_speakers = this.state.male_speakers
        let female_speakers = this.state.female_speakers
        let male_addressees = this.state.male_addressees
        let female_addressees = this.state.female_addressees
        let nonhuman_addressees = this.state.nonhuman_addressees
        let multiple_addressees = this.state.multiple_addressees
        // if user selects 'any' for chapter, resets the char filters based on their local values
        if ((value[value.length - 1] === 'anychp' || value.length === 0) && this.state.selectedSpeaker.length === 0 && this.state.selectedAddressee.length === 0){
            value = ['anychp']
            male_speakers = male_speakers.map(char => [char[0], 1])
            female_speakers = female_speakers.map(char => [char[0], 1])
            male_addressees = male_addressees.map(char => [char[0], 1])
            female_addressees = female_addressees.map(char => [char[0], 1])
            nonhuman_addressees = nonhuman_addressees.map(char => [char[0], 1])
            nonhuman_addressees = multiple_addressees.map(char => [char[0], 1])
            // console.log(male_speakers)
        } else {
            // if replacing 'any' with a chapter, first undisplay everything
            if (value[0] === 'anychp') {
                value = [value[1]]
                male_speakers.forEach(char => char[1] = 0)
                female_speakers.forEach(char => char[1] = 0)
                male_addressees.forEach(char => char[1] = 0)
                female_addressees.forEach(char => char[1] = 0)
                nonhuman_addressees.forEach(char => char[1] = 0)
                multiple_addressees.forEach(char => char[1] = 0)
            }
            // if deselect a chapter (and at least one non-any chapter remains), remove any characters relevant to the removed chapter but not to the others
            if (prevChps.length > value.length) {
                difference = prevChps.filter(x => !value.includes(x))[0]
                male_speakers = this.checkCharInChp(male_speakers, this.state.graph, difference, true)
                female_speakers = this.checkCharInChp(female_speakers, this.state.graph, difference, true)
                male_addressees = this.checkCharInChp(male_addressees, this.state.graph, difference, true)
                female_addressees = this.checkCharInChp(female_addressees, this.state.graph, difference, true)
                nonhuman_addressees = this.checkCharInChp(nonhuman_addressees, this.state.graph, difference, true)
                multiple_addressees = this.checkCharInChp(multiple_addressees, this.state.graph, difference, true)
            } else { 
                // if selecta a chapter, display new characters
                if (value.length === 1) {
                    difference = value[0]
                } else {
                    difference = value.filter(x => !prevChps.includes(x))[0]
                }
                male_speakers = this.checkCharInChp(male_speakers, this.state.graph, difference, false)
                female_speakers = this.checkCharInChp(female_speakers, this.state.graph, difference, false)
                male_addressees = this.checkCharInChp(male_addressees, this.state.graph, difference, false)
                female_addressees = this.checkCharInChp(female_addressees, this.state.graph, difference, false)
                nonhuman_addressees = this.checkCharInChp(nonhuman_addressees, this.state.graph, difference, false)
                multiple_addressees = this.checkCharInChp(multiple_addressees, this.state.graph, difference, false)
            }
        }    
        // filter out any characters not allowed by the gender filters
        male_speakers = this.checkGender(male_speakers, 'male', this.state.selectedSpkrGen)
        female_speakers = this.checkGender(female_speakers, 'female', this.state.selectedSpkrGen)
        male_addressees = this.checkGender(male_addressees, 'male', this.state.selectedAddrGen)
        female_addressees = this.checkGender(female_addressees, 'female', this.state.selectedAddrGen)
        nonhuman_addressees = this.checkGender(nonhuman_addressees, 'nonhuman', this.state.selectedAddrGen)
        multiple_addressees = this.checkGender(multiple_addressees, 'multiple', this.state.selectedAddrGen)      
        this.setState({
            male_speakers: male_speakers,
            female_speakers: female_speakers,
            male_addressees: male_addressees,
            female_addressees: female_addressees,
            nonhuman_addressees: nonhuman_addressees,
            multiple_addressees: multiple_addressees,
            selectedChapters: value
        })
    }

    // when a char is updated, update the chapter and the other select
    handleCharChange(value, type) {
        // type is spkr/addr
        let chars = []
        if (type === 'addr') {
            if (this.state.selectedSpkrGen.includes('male')) {
                chars.push([ ...this.state.male_speakers ])
            } else {
                chars.push([])
            }
            if (this.state.selectedSpkrGen.includes('female')) {
                chars.push([ ...this.state.female_speakers ])
            } else {
                chars.push([])
            }
        } else {
            if (this.state.selectedAddrGen.includes('male')) {
                chars.push([ ...this.state.male_addressees ])
            } else {
                chars.push([])
            }
            if (this.state.selectedAddrGen.includes('female')) {
                chars.push([ ...this.state.female_addressees ])
            } else {
                chars.push([])
            }
            if (this.state.selectedAddrGen.includes('nonhuman')) {
                chars.push([ ...this.state.nonhuman_addressees ])
            } else {
                chars.push([])
            }
            if (this.state.selectedAddrGen.includes('multiple')) {
                chars.push([ ...this.state.multiple_addressees ])
            } else {
                chars.push([])
            }
        }
        // if chp is any and a select is empty, display all chars
        if (value.length === 0 && this.state.selectedChapters[0] === 'anychp') {
            for (let i = 0; i < chars.length; i++) {
                if (chars[i].length) {
                    for (let j = 0; j < chars[i].length; j++) {
                        chars[i][j][1] = 1
                    }
                }
            }
        } else if (value.length !== 0 && this.state.selectedChapters[0] === 'anychp') {
            // if chp is any and there exists a spkr/addr, display any char in chars that has an exchange
            value.forEach(c2 => {
                let temp = []
                for (let i = 0; i < chars.length; i++) {
                    if (chars[i].length) {
                        for (let j = 0; j < chars[i].length; j++) {
                            temp.push(this.checkHasExchange(chars[i][j], c2, this.state.graph))
                        }
                        chars[i] = this.getIntersection(chars[i], temp)
                    }
                }
            })
        } else if (value.length === 0 && this.state.selectedChapters[0] !== 'anychp') { 
            //when a select is empty and a chp is specified, reset the other select's options by chp and gen
            chars.forEach(ls => ls.map(char => [char[0], 0]))
            // if chars are speakers
            if (chars.length === 2) {
                if (this.state.selectedSpkrGen.includes('male')) {
                    this.state.selectedChapters.forEach(chp => {
                        chars[0] = this.checkCharInChp(chars[0], this.graph, chp, false)
                    })
                }
                if (this.state.selectedSpkrGen.includes('female')) {
                    this.state.selectedChapters.forEach(chp => {
                        chars[1] = this.checkCharInChp(chars[1], this.graph, chp, false)
                    })
                }
            } else {
                // if chars are addressees
                if (this.state.selectedAddrGen.includes('male')) {
                    this.state.selectedChapters.forEach(chp => {
                        chars[0] = this.checkCharInChp(chars[0], this.graph, chp, false)
                    })
                }
                if (this.state.selectedAddrGen.includes('female')) {
                    this.state.selectedChapters.forEach(chp => {
                        chars[1] = this.checkCharInChp(chars[1], this.graph, chp, false)
                    })
                }                
                if (this.state.selectedAddrGen.includes('nonhuman')) {
                    this.state.selectedChapters.forEach(chp => {
                        chars[2] = this.checkCharInChp(chars[2], this.graph, chp, false)
                    })
                }
                if (this.state.selectedAddrGen.includes('multiple')) {
                    this.state.selectedChapters.forEach(chp => {
                        chars[3] = this.checkCharInChp(chars[3], this.graph, chp, false)
                    })
                }
            }
        } else {
            // there exists a spkr/addr and a chp
            let difference 
            let prevChars
            if (type === 'addr') {
                prevChars = this.state.selectedSpeaker
            } else {
                prevChars = this.state.selectedAddressee
            } 
            if (prevChars.length > value.length) { // deselect
                difference = value[0]
                chars.filter(ls => ls.length > 0).forEach(ls => {
                    ls.forEach(char => {
                        this.state.selectedChapters.forEach(chp => {
                            char = this.checkHasExchangeInChp(char, difference, chp, this.state.graph)
                        })
                    })
                })
            } else { // select
                difference = value.filter(x => !prevChars.includes(x))[0]
                chars.filter(ls => ls.length > 0).forEach(ls => {
                    ls.forEach(char => {
                        this.state.selectedChapters.forEach(chp => {
                            char = this.checkHasExchangeInChp(char, difference, chp, this.state.graph)
                        })
                    })
                })
            }
        }
        return chars
    }

    handleSpkrChange(value) {
        let chars = this.handleCharChange(value, 'spkr')
        if (this.state.selectedAddrGen.includes('male')) {
            this.setState({
                male_addressees: chars[0],
            })
        }
        if (this.state.selectedAddrGen.includes('female')) {
            this.setState({
                female_addressees: chars[1],
            })
        }
        if (this.state.selectedAddrGen.includes('nonhuman')) {
            this.setState({
                nonhuman_addressees: chars[2],
            })
        }
        if (this.state.selectedAddrGen.includes('multiple')) {
            this.setState({
                multiple_addressees: chars[3],
            })
        }
        this.setState({
            selectedSpeaker: value,
        })
    }

    handleAddrChange(value) {
        let chars = this.handleCharChange(value, 'addr')
        if (this.state.selectedSpkrGen.includes('male')) {
            this.setState({
                male_speakers: chars[0],
            })
        }
        if (this.state.selectedSpkrGen.includes('female')) {
            this.setState({
                female_speakers: chars[1],
            })
        }
        this.setState({
            selectedAddressee: value
        })
    }

    togglePanel() {
        this.setState({
            filterActiveKey: this.state.filterActiveKey.length ? [] : ['panel1'],
            openOptions: !this.state.openOptions
        })
    }

    async componentDidMount() {
        initDriver(this.uri, this.user, this.password)
        const driver = getDriver()
        const session = driver.session()
        let query = 'match exchange=(s:Character)-[:SPEAKER_OF]-(g:Genji_Poem)-[:ADDRESSEE_OF]-(a:Character) return exchange'
        let res = await session.readTransaction(tx => tx.run(query))
        let exchange = res.records.map(row => {return toNativeTypes(row.get('exchange'))})
        let graph = this.Graph()
        let characters = []
        let male_speakers = []
        let female_speakers = []
        let male_addressees = []
        let female_addressees = []
        let nonhuman_addressees = []
        let multiple_addressees = []
        this.state.addresseeGenderList.forEach(gender => graph.addNode(gender))
        graph.addNode('soliloquies')
        for (let i = 0; i < exchange.length; i++) {
            let pnum = exchange[i].segments[0].end.properties.pnum
            let spkr = exchange[i].segments[0].start.properties.name
            let spkr_gen = exchange[i].segments[0].start.properties.gender
            let addr = exchange[i].segments[1].end.properties.name
            let addr_gen = exchange[i].segments[1].end.properties.gender
            // if (pnum === '44TA09') {
            //     console.log(pnum, spkr, addr)
            // }
            if (!this.hasNode(graph, spkr)) {
                characters.push(spkr)
                graph.addEdge(spkr_gen, spkr)
            }
            if (!this.hasNode(graph, addr)) {
                characters.push(addr)
                graph.addEdge(addr_gen, addr)
            }
            if (!graph.hasEdge(pnum, parseInt(pnum.substring(0,2)))) {
                graph.addEdge(pnum, parseInt(pnum.substring(0,2)))
            }
            // w=3 for speaker, w=2 for addressee
            if (!graph.hasEdge(spkr, pnum, 3)) {
                graph.addEdge(spkr, pnum, 3)
            }
            if (!graph.hasEdge(addr, pnum, 2)) {
                graph.addEdge(addr, pnum, 2)
            }
            if (spkr === addr) {
                graph.addEdge(spkr, 'soliloquies')
            }
        }
        for (let i = 0; i < characters.length; i++) {
            let add_list = graph.adjacent(characters[i]).filter(n => graph.getEdgeWeight(characters[i], n) === 2)
            if (add_list.length === 0 && graph.hasEdge(characters[i], 'soliloquies')) {
                add_list.push(['1'])
            }
            if (add_list.length > 0) {
                if (graph.hasEdge('male', characters[i])) {
                    male_addressees.push(characters[i])
                } else if (graph.hasEdge('female', characters[i])) {
                    female_addressees.push(characters[i])
                } else if (graph.hasEdge('multiple', characters[i])) {
                    multiple_addressees.push(characters[i])
                } else if (graph.hasEdge('nonhuman', characters[i])) {
                    nonhuman_addressees.push(characters[i])
                }
            }
            let spk_list = graph.adjacent(characters[i]).filter(n => graph.getEdgeWeight(characters[i], n) === 3)
            if (spk_list.length === 0 && graph.hasEdge(characters[i], 'soliloquies')) {
                spk_list.push(['1'])
            }
            if (spk_list.length > 0) {
                if (graph.hasEdge('male', characters[i])) {
                    male_speakers.push(characters[i])
                } else if (graph.hasEdge('female', characters[i])) {
                    female_speakers.push(characters[i])
                }
            }
        }
        this.setState({
            characters:characters.sort().map(e => [e, 1]),
            male_speakers: male_speakers.sort().map(e => [e, 1]), 
            female_speakers: female_speakers.sort().map(e => [e, 1]), 
            male_addressees: male_addressees.sort().map(e => [e, 1]),
            female_addressees: female_addressees.sort().map(e => [e, 1]),
            multiple_addressees: multiple_addressees.sort().map(e => [e, 1]),
            nonhuman_addressees: nonhuman_addressees.sort().map(e => [e, 1]),
            graph: graph,
        })
        session.close()
        closeDriver()
    }

    render() {
        return (
            <div>
                <Collapse 
                    ghost={true} 
                    activeKey={this.state.filterActiveKey} 
                    onChange={() => this.togglePanel()}  
                >
                <Panel 
                    className='collapse-panel-custom'
                    key='panel1' 
                    header={'Toggle Filters'} 
                >
                <form>
                    <Select
                        ref={this.chpFilterRef}
                        style={{ width:200 }}
                        mode={'multiple'}
                        open={true}
                        showSearch
                        placeholder="Select chapter(s)"
                        value={this.state.selectedChapters}
                        onChange={this.handleChpChange}
                        allowClear={true}
                        dropdownRender={(menu) => (
                            <div>
                                {menu}
                            </div>
                        )}
                        getPopupContainer={triggerNode => triggerNode.parentNode}
                    >
                        <Option className={'chp_opt'} value='anychp'>Any</Option>
                        {this.state.chapters.map(chp => <Option className={'chp_opt'} key={chp} value={chp}>{chp + ' '+getChpList()[chp-1]}</Option>)}
                    </Select>
                </form>
                <form>
                    <CheckboxGroup defaultValue={this.state.speakerGenderList} onChange={this.handleSpkrGenChange}>
                        <Checkbox value={'male'} style={{ backgroundColor: 'rgba(72, 209, 204, 0.3)'}}>male</Checkbox>
                        <Checkbox value={'female'} style={{ backgroundColor: 'rgba(255, 182, 193, 0.3)'}}>female</Checkbox>
                    </CheckboxGroup>
                    <br />
                    <Select 
                        style={{ width:200 }}
                        mode={'multiple'}
                        open={true}
                        showSearch
                        placeholder="Select speaker(s)"
                        onChange={this.handleSpkrChange}
                        value={this.state.selectedSpeaker}
                        allowClear={true}
                        // optionFilterProp={'children'}
                        filterSort={
                            (optionA, optionB) => {
                                if (optionA.disabled === true && optionB.disabled === false) {
                                    return 1
                                } 
                                else if (optionA.disabled === false && optionB.disabled === true) {
                                    return -1
                                } else {
                                    return 0
                                }
                            }
                        }
                        notFoundContent={<Spin />}
                        getPopupContainer={triggerNode => triggerNode.parentNode}
                    >
                        {[...this.state.male_speakers, ...this.state.female_speakers].sort((a, b) => a[0].localeCompare(b[0])).map(spkr => 
                            <Option 
                                key={'spkr_'+spkr[0]} 
                                value={spkr[0]} 
                                disabled={!spkr[1]} 
                                style={{
                                    backgroundColor: this.state.male_speakers.some(e => spkr[0] === e[0]) ? 'rgba(72, 209, 204, 0.3)' : 'rgba(255, 182, 193, 0.3)',
                            }}>
                                {spkr[0]}
                            </Option>)}
                    </Select>
                </form>
                <form>
                    <CheckboxGroup defaultValue={this.state.addresseeGenderList} onChange={this.handleAddrGenChange}>
                        <Row justify="space-between">
                            <Col>
                                <Checkbox value={'male'} style={{ backgroundColor: 'rgba(72, 209, 204, 0.3)'}}>male</Checkbox>
                            </Col>
                            <Col>
                                <Checkbox value={'female'} style={{ backgroundColor: 'rgba(255, 182, 193, 0.3)'}}>female</Checkbox>
                            </Col>
                        </Row>
                        <Row justify="space-between">
                            <Col>
                                <Checkbox value={'nonhuman'} style={{ backgroundColor: 'rgba(144, 238, 144, 0.3)'}}>nonhuman</Checkbox>
                            </Col>
                            <Col>
                                <Checkbox value={'multiple'} style={{ backgroundColor: 'rgba(255, 250, 205, 0.3)'}}>multiple</Checkbox>
                            </Col>
                        </Row>
                    </CheckboxGroup>
                    <br />
                    <Select 
                        style={{ width:200 }}
                        mode={'multiple'}
                        open={true}
                        showSearch
                        placeholder="Select addressee(s)"
                        onChange={this.handleAddrChange}
                        allowClear={true}
                        filterSort={
                            (optionA, optionB) => {
                                if (optionA.disabled === true && optionB.disabled === false) {
                                    return 1
                                } 
                                else if (optionA.disabled === false && optionB.disabled === true) {
                                    return -1
                                } else {
                                    return 0
                                }
                            }
                        }
                        notFoundContent={<Spin />}
                        value={this.state.selectedAddressee}
                        getPopupContainer={triggerNode => triggerNode.parentNode}
                    >
                        {[...this.state.male_addressees, ...this.state.female_addressees, ...this.state.nonhuman_addressees, ...this.state.multiple_addressees].sort((a, b) => a[0].localeCompare(b[0])).map(addr => 
                        <Option 
                            key={'addr_'+addr[0]} 
                            value={addr[0]} 
                            disabled={!addr[1]} 
                            style={{
                                backgroundColor: this.state.male_addressees.some(e => addr[0] === e[0]) ? 'rgba(72, 209, 204, 0.3)' : 
                                this.state.female_addressees.some(e => addr[0] === e[0]) ? 'rgba(255, 182, 193, 0.3)' : 
                                this.state.nonhuman_addressees.some(e => addr[0] === e[0]) ? 'rgba(144, 238, 144, 0.3)' : 'rgba(255, 250, 205, 0.3)'
                            }
                        }>
                            {addr[0]}
                        </Option>)}
                    </Select>
                </form>
                <Link 
                    to={`/search/${this.state.selectedChapters}/${this.state.selectedSpkrGen}/${this.state.selectedSpeaker}/${this.state.selectedAddrGen}/${this.state.selectedAddressee}`}
                    // state={{
                    //     chapter: this.state.selectedChapters,
                    //     speaker: this.state.selectedSpeaker,
                    //     addressee: this.state.selectedAddressee,
                    //     spkrGen: this.state.selectedSpkrGen,
                    //     addrGen: this.state.selectedAddrGen
                    // }}
                >
                    <Button>Click me</Button>
                </Link>
                </Panel>
                </Collapse>
                <Outlet />
                {/* <Routes>
                    <Route path="/search/home" element={<Home />} />
                </Routes> */}
            </div>
        )
    }
}