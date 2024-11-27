import React from 'react';
import PropTypes from 'prop-types';

export default class GeneratedTests extends React.Component {
    static propTypes = {
        generatedTests: PropTypes.array,
        isTestStreamActive: PropTypes.bool,
        getComponent: PropTypes.func.isRequired,
    }

    static defaultProps = {
        generatedTests: [],
        isTestStreamActive: false
    }

    state = {
        testResponses: {},
        runningTests: {},
    }

    handleRunTest = async (test) => {
        this.setState(prevState => ({
            runningTests: {
                ...prevState.runningTests,
                [test.uuid]: true
            }
        }));

        try {
            const fetchOptions = {
                method: test.request.method,
                headers: test.request.headers || {}
            };
            if (test.request.json_body && !(test.request.method == "GET" || test.request.method == "HEAD")) {
                fetchOptions.body = JSON.stringify(test.request.json_body);
            }

            let response = await fetch(test.request.url, fetchOptions);
            response = await response.json();

            this.setState(prevState => ({
                testResponses: {
                    ...prevState.testResponses,
                    [test.uuid]: response
                },
                runningTests: {
                    ...prevState.runningTests,
                    [test.uuid]: false
                }
            }));
        } catch (error) {
            console.error('Test execution error:', error);
            this.setState(prevState => ({
                testResponses: {
                    ...prevState.testResponses,
                    [test.uuid]: { error: error.message }
                },
                runningTests: {
                    ...prevState.runningTests,
                    [test.uuid]: false
                }
            }));
        }
    };

    render() {
        let { getComponent } = this.props;

        const HighlightCode = getComponent("HighlightCode", true);
        const { generatedTests, isTestStreamActive } = this.props;
        const { testResponses, runningTests } = this.state;

        if (generatedTests.length === 0)
            return null;

        return (
        <div className="operation-generated-tests">
            <h4>Generated Tests</h4>
            {isTestStreamActive ? (
            <div>Generating tests...</div>
            ) : (
            <details>
                <summary>View Tests ({generatedTests.length})</summary>
                <div>
                {generatedTests.map((test, index) => (
                    <div 
                        key={index} 
                        style={{ 
                            marginBottom: '16px', 
                            border: '1px solid #ccc', 
                            padding: '8px', 
                            borderRadius: '4px' 
                        }}
                    >
                    <h4 
                        style={{ 
                            margin: '2px',
                        }}
                    >
                        {test.description}
                    </h4>
                    <HighlightCode language="json">
                        {JSON.stringify(test.request, "", 4)}
                    </HighlightCode>
                    <button
                        style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        backgroundColor: runningTests[test.uuid] ? '#6c757d' : '#007BFF',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: runningTests[test.uuid] ? 'not-allowed' : 'pointer',
                        opacity: runningTests[test.uuid] ? 0.6 : 1
                        }}
                        onClick={() => this.handleRunTest(test)}
                        disabled={runningTests[test.uuid]}
                    >
                       {runningTests[test.uuid] ? 'Running...' : 'Run Test'}
                    </button>
                    {testResponses[test.uuid] && (
                        <div style={{ marginTop: '16px' }}>
                            <h5>Test Response:</h5>
                            <HighlightCode language="json">
                                {JSON.stringify(testResponses[test.uuid], null, 4)}
                            </HighlightCode>
                        </div>
                    )}
                    </div>
                ))}
                </div>
            </details>
            )}
        </div>
        );
    }
}